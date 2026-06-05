import { createAdminClient } from '@/lib/supabase-server';
import {
  sendMessage,
  sendDocument,
  sendChatAction,
  getFile,
  downloadFile,
  answerCallbackQuery,
  editMessageText,
} from './api';
import {
  handleStartCommand,
  handleLinkWithToken,
  handleSaldoCommand,
  handleBisnisCommand,
  handleHelpCommand,
  handleSettingCommand,
  handleTanyaCommand,
} from './commands';
import { extractTransactionFromText } from '@/lib/ai/parseTransaction';
import { parseDateFromText, isListTransactionIntent } from './dateParser';
import { parsePeriodFromText, detectReportType, ReportType } from './periodParser';
import { smartResolveTransaction } from '@/lib/import/smartResolver';
import {
  generateIncomeStatementPDF,
  generateBalanceSheetPDF,
  generateCashFlowPDF,
} from './reportGenerator';
import {
  formatTransactionConfirmation,
  formatTransactionSaved,
  formatTransactionList,
  formatOcrDraft,
  formatOcrSaved,
  TransactionListItem,
} from './formatter';
import {
  TelegramUpdate,
  TelegramMessage,
  TelegramCallbackQuery,
  ParsedTransaction,
} from './types';
import { scanReceipt, OcrQuotaExceededError } from '@/lib/ocr';
import type { OcrProvider } from '@/lib/ocr/types';

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  // Branch 1: callback dari inline keyboard (klik tombol)
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }

  const message = update.message ?? update.edited_message;
  if (!message) return;

  // Branch 2: foto struk → OCR flow
  if (message.photo && message.photo.length > 0) {
    await handlePhotoMessage(message);
    return;
  }

  if (!message.text) return;

  const chatId = message.chat.id;
  const text = message.text.trim();
  const from = message.from;

  if (text.startsWith('/')) {
    const [cmd, ...args] = text.split(/\s+/);
    const cmdName = cmd.toLowerCase().split('@')[0]; // hapus @botname jika ada

    switch (cmdName) {
      case '/start': await handleStartCommand(chatId, args.join(' '), from); break;
      case '/link':  await handleLinkWithToken(chatId, args[0] ?? '', from); break;
      case '/saldo': await handleSaldoCommand(chatId); break;
      case '/bisnis':await handleBisnisCommand(chatId); break;
      case '/tanya':
      case '/ask':   await handleTanyaCommand(chatId, args.join(' ')); break;
      case '/help':    await handleHelpCommand(chatId); break;
      case '/setting':
      case '/settings': await handleSettingCommand(chatId); break;
      default:
        await sendMessage(chatId, `Perintah tidak dikenal. Ketik /help untuk panduan.`);
    }
    return;
  }

  await handleTransactionMessage(chatId, text);
}

async function handleTransactionMessage(chatId: number, text: string): Promise<void> {
  const admin = createAdminClient();

  const { data: conn } = await admin
    .from('telegram_connections')
    .select('user_id, default_business_id, default_transaction_status, pending_transaction, pending_expires_at')
    .eq('telegram_chat_id', chatId)
    .single();

  if (!conn) {
    await sendMessage(chatId, 'Akun belum terhubung. Ketik /start untuk instruksi.');
    return;
  }

  // Handle pemilihan bisnis
  const pending = conn.pending_transaction as (ParsedTransaction & { _type?: string; businesses?: { id: string; business_name: string }[] }) | null;
  const pendingValid = conn.pending_expires_at && new Date(conn.pending_expires_at) > new Date();

  if (pendingValid && pending?._type === 'bisnis_selection') {
    const idx = parseInt(text.trim()) - 1;
    const businesses = pending.businesses ?? [];
    if (idx >= 0 && idx < businesses.length) {
      await admin
        .from('telegram_connections')
        .update({
          default_business_id: businesses[idx].id,
          pending_transaction: null,
          pending_expires_at: null,
        })
        .eq('telegram_chat_id', chatId);
      await sendMessage(
        chatId,
        `✅ Bisnis aktif diubah ke *${businesses[idx].business_name}*`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
  }

  // Handle konfirmasi transaksi pending
  if (pendingValid && pending && !pending._type) {
    const lower = text.toLowerCase().trim();

    // Koreksi kategori OPEX <-> VAR
    const CATEGORY_CORRECTIONS: Record<string, 'OPEX' | 'VAR'> = {
      'opex': 'OPEX', 'operasional': 'OPEX', 'beban operasional': 'OPEX',
      'var': 'VAR', 'hpp': 'VAR', 'cogs': 'VAR', 'variabel': 'VAR', 'variable': 'VAR', 'variable cost': 'VAR', 'harga pokok': 'VAR',
    };
    const correctedCategory = CATEGORY_CORRECTIONS[lower];
    if (correctedCategory && correctedCategory !== pending.category) {
      const updatedPending = { ...pending, category: correctedCategory, confidence: 'high' as const };
      await admin
        .from('telegram_connections')
        .update({
          pending_transaction: updatedPending,
          pending_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })
        .eq('telegram_chat_id', chatId);
      const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
      await sendMessage(
        chatId,
        `✏️ Kategori diubah ke *${correctedCategory}*\n\n${formatTransactionConfirmation(updatedPending as ParsedTransaction, today)}`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    if (['ya', 'y', 'yes', 'iya', 'ok', 'oke'].includes(lower)) {
      const status: 'draft' | 'posted' =
        conn.default_transaction_status === 'posted' ? 'posted' : 'draft';
      await saveTransaction(chatId, conn.user_id, conn.default_business_id, pending as ParsedTransaction, status);
      await admin
        .from('telegram_connections')
        .update({ pending_transaction: null, pending_expires_at: null })
        .eq('telegram_chat_id', chatId);
      return;
    }
    if (['tidak', 'n', 'no', 'batal', 'cancel'].includes(lower)) {
      await admin
        .from('telegram_connections')
        .update({ pending_transaction: null, pending_expires_at: null })
        .eq('telegram_chat_id', chatId);
      await sendMessage(chatId, '❌ Transaksi dibatalkan.');
      return;
    }
    // Jika bukan ya/tidak/koreksi, proses sebagai transaksi baru (fall through)
  }

  if (!conn.default_business_id) {
    await sendMessage(chatId, 'Belum ada bisnis aktif. Ketik /bisnis untuk memilih bisnis.');
    return;
  }

  // Deteksi intent laporan PDF: "[jenis report] [periode]"
  const reportType = detectReportType(text);
  if (reportType) {
    const period = parsePeriodFromText(text);
    if (!period) {
      await sendMessage(
        chatId,
        `Periode tidak dikenal. Contoh:\n\`laba rugi bulan ini\`\n\`neraca bulan lalu\`\n\`arus kas tahun ini\`\n\`laba rugi januari 2026\`\n\`neraca Q1 2026\``,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    await handleReportRequest(chatId, conn.default_business_id, reportType, period);
    return;
  }

  // Deteksi intent "lihat transaksi [tanggal]"
  if (isListTransactionIntent(text)) {
    const parsedDate = parseDateFromText(text);
    if (!parsedDate) {
      await sendMessage(
        chatId,
        `Tanggal tidak dikenal. Coba:\n\`lihat transaksi kemarin\`\n\`lihat transaksi hari ini\`\n\`lihat transaksi 10 april\`\n\`lihat transaksi 10/04/2026\``,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    await showTransactionsByDate(chatId, conn.default_business_id, parsedDate.date, parsedDate.label);
    return;
  }

  // Ekstrak via AI provider chain (Gemini→Groq) + fallback regex.
  // Sama dgn parser di chat panel web (reuse extractTransactionFromText).
  const extractResult = await extractTransactionFromText(text);
  if (!extractResult) {
    await sendMessage(
      chatId,
      `Tidak bisa membaca transaksi. Pastikan format:\n_deskripsi jumlah_\n\nContoh: \`jual kopi 150000\`\n\nKetik /help untuk panduan.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Adaptasi ke ParsedTransaction. Kategori akhir di-resolve via smartResolveTransaction
  // (lebih akurat dari category_hint mentah), konsisten dgn alur web.
  const { extracted } = extractResult;
  const { data: accountsForCat } = await admin
    .from('accounts')
    .select('*')
    .eq('business_id', conn.default_business_id)
    .eq('is_active', true);
  const resolvedCat = smartResolveTransaction(
    extracted.name,
    (accountsForCat ?? []) as never,
    extracted.category_hint ?? undefined
  );
  const parsed: ParsedTransaction = {
    name: extracted.name,
    amount: extracted.amount,
    category: resolvedCat.category,
    confidence: resolvedCat.confidence,
    raw: text,
  };

  const today = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // Simpan pending dan minta konfirmasi
  await admin
    .from('telegram_connections')
    .update({
      pending_transaction: parsed,
      pending_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    })
    .eq('telegram_chat_id', chatId);

  await sendMessage(
    chatId,
    formatTransactionConfirmation(parsed, today),
    { parse_mode: 'Markdown' }
  );
}

async function saveTransaction(
  chatId: number,
  userId: string,
  businessId: string | null,
  parsed: ParsedTransaction,
  status: 'draft' | 'posted' = 'draft'
): Promise<void> {
  const admin = createAdminClient();

  if (!businessId) {
    await sendMessage(chatId, '❌ Tidak ada bisnis aktif. Ketik /bisnis untuk memilih.');
    return;
  }

  // Verifikasi role (business_manager atau superadmin)
  const { data: role } = await admin
    .from('user_business_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('business_id', businessId)
    .single();

  if (!role || !['business_manager', 'superadmin'].includes(role.role)) {
    await sendMessage(chatId, '❌ Kamu tidak memiliki akses untuk mencatat transaksi di bisnis ini.');
    return;
  }

  // Cek period lock
  const today = new Date().toISOString().split('T')[0];
  const { data: biz } = await admin
    .from('businesses')
    .select('business_name, closed_until_date')
    .eq('id', businessId)
    .single();

  if (biz?.closed_until_date && today <= biz.closed_until_date) {
    await sendMessage(
      chatId,
      `❌ Periode hingga ${biz.closed_until_date} sudah dikunci. Transaksi tidak bisa dicatat.`
    );
    return;
  }

  // Auto-resolve double-entry accounts
  const { data: accounts } = await admin
    .from('accounts')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true);

  const resolved = smartResolveTransaction(parsed.name, accounts ?? [], parsed.category);
  const isDoubleEntry = !!(resolved.debit_account_id && resolved.credit_account_id);

  const { error } = await admin.from('transactions').insert({
    business_id: businessId,
    date: today,
    category: resolved.category,
    name: 'Via AxionBot',
    amount: parsed.amount,
    description: parsed.name,
    account: '',
    status,
    created_by: userId,
    debit_account_id: resolved.debit_account_id || null,
    credit_account_id: resolved.credit_account_id || null,
    is_double_entry: isDoubleEntry,
  });

  if (error) {
    console.error('[telegram] insert transaction error:', error);
    await sendMessage(chatId, '❌ Gagal menyimpan transaksi. Coba lagi nanti.');
    return;
  }

  await sendMessage(
    chatId,
    formatTransactionSaved(parsed.name, parsed.amount, parsed.category, biz?.business_name ?? 'Bisnis', status),
    { parse_mode: 'Markdown' }
  );
}

async function handleReportRequest(
  chatId: number,
  businessId: string,
  reportType: ReportType,
  period: { startDate: string; endDate: string; label: string }
): Promise<void> {
  await sendChatAction(chatId, 'upload_document');

  try {
    let pdfBuffer: Buffer;
    let filename: string;
    let caption: string;

    if (reportType === 'income_statement') {
      pdfBuffer = await generateIncomeStatementPDF(businessId, period.startDate, period.endDate, period.label);
      filename = `laba-rugi-${period.startDate}-${period.endDate}.pdf`;
      caption = `📊 *Laporan Laba Rugi*\nPeriode: ${period.label}`;
    } else if (reportType === 'balance_sheet') {
      pdfBuffer = await generateBalanceSheetPDF(businessId, period.endDate, period.label);
      filename = `neraca-${period.endDate}.pdf`;
      caption = `📋 *Neraca*\nPer ${period.label}`;
    } else {
      pdfBuffer = await generateCashFlowPDF(businessId, period.startDate, period.endDate, period.label);
      filename = `arus-kas-${period.startDate}-${period.endDate}.pdf`;
      caption = `💰 *Laporan Arus Kas*\nPeriode: ${period.label}`;
    }

    await sendDocument(chatId, pdfBuffer, filename, caption);
  } catch (err) {
    console.error('[telegram] report generation error:', err);
    await sendMessage(chatId, '❌ Gagal membuat laporan. Coba lagi nanti.');
  }
}

async function showTransactionsByDate(
  chatId: number,
  businessId: string,
  dateStr: string,
  dateLabel: string
): Promise<void> {
  const admin = createAdminClient();

  const { data: biz } = await admin
    .from('businesses')
    .select('business_name')
    .eq('id', businessId)
    .single();

  const { data: txs, error } = await admin
    .from('active_transactions')
    .select('name, description, amount, category, status')
    .eq('business_id', businessId)
    .eq('date', dateStr)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[telegram] fetch transactions error:', error);
    await sendMessage(chatId, '❌ Gagal mengambil data transaksi.');
    return;
  }

  const items: TransactionListItem[] = (txs ?? []).map((t) => ({
    name: t.name,
    description: t.description,
    amount: t.amount,
    category: t.category,
    status: t.status,
  }));

  // Format tanggal jadi DD/MM/YYYY untuk display
  const [y, m, d] = dateStr.split('-');
  const displayDate = `${d}/${m}/${y}`;

  await sendMessage(
    chatId,
    formatTransactionList(items, dateLabel, displayDate, biz?.business_name ?? 'Bisnis'),
    { parse_mode: 'Markdown' }
  );
}

// ============================================================================
// OCR PHOTO HANDLING
// ============================================================================

/**
 * Pending OCR draft yang disimpan di telegram_connections.pending_transaction.
 * Pakai discriminator _type biar gak konflik dengan ParsedTransaction reguler.
 */
type PendingOcrDraft = {
  _type: 'ocr_draft';
  date?: string;
  total?: number;
  vendor?: string;
  provider: OcrProvider;
  raw_text: string;
};

async function handlePhotoMessage(message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id;
  const admin = createAdminClient();

  // Lookup koneksi user
  const { data: conn } = await admin
    .from('telegram_connections')
    .select('user_id, default_business_id, default_transaction_status')
    .eq('telegram_chat_id', chatId)
    .single();

  if (!conn) {
    await sendMessage(chatId, 'Akun belum terhubung. Ketik /start untuk instruksi.');
    return;
  }

  if (!conn.default_business_id) {
    await sendMessage(chatId, 'Belum ada bisnis aktif. Ketik /bisnis untuk memilih bisnis.');
    return;
  }

  // Ambil foto resolusi tertinggi
  const photos = message.photo ?? [];
  const largest = photos[photos.length - 1];
  if (!largest) return;

  await sendChatAction(chatId, 'typing');

  // Download foto dari Telegram
  const filePath = await getFile(largest.file_id);
  if (!filePath) {
    await sendMessage(chatId, '❌ Gagal mengambil foto dari Telegram. Coba kirim ulang.');
    return;
  }
  const buffer = await downloadFile(filePath);
  if (!buffer) {
    await sendMessage(chatId, '❌ Gagal mengunduh foto. Coba kirim ulang.');
    return;
  }

  // OCR scan
  let parsed;
  let provider: OcrProvider;
  let rawText: string;
  try {
    const result = await scanReceipt(buffer);
    parsed = result.parsed;
    provider = result.provider;
    rawText = result.raw_text;
  } catch (err) {
    if (err instanceof OcrQuotaExceededError) {
      await sendMessage(chatId, `❌ ${err.message}`);
      return;
    }
    console.error('[telegram] OCR error:', err);
    await sendMessage(chatId, '❌ Gagal memproses foto struk. Coba foto yang lebih jelas.');
    return;
  }

  if (!parsed.total && !parsed.vendor && !parsed.date) {
    await sendMessage(
      chatId,
      '⚠️ Tidak ada data yang berhasil dibaca dari struk. Pastikan foto tajam dan terang.'
    );
    return;
  }

  // Simpan pending draft
  const draft: PendingOcrDraft = {
    _type: 'ocr_draft',
    date: parsed.date,
    total: parsed.total,
    vendor: parsed.vendor,
    provider,
    raw_text: rawText,
  };
  await admin
    .from('telegram_connections')
    .update({
      pending_transaction: draft as unknown as ParsedTransaction,
      pending_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    })
    .eq('telegram_chat_id', chatId);

  await sendMessage(
    chatId,
    formatOcrDraft({ date: draft.date, total: draft.total, vendor: draft.vendor, provider }),
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Simpan', callback_data: 'ocr:save' },
            { text: '❌ Batal', callback_data: 'ocr:cancel' },
          ],
        ],
      },
    }
  );
}

// ============================================================================
// CALLBACK QUERY (INLINE KEYBOARD BUTTONS)
// ============================================================================

async function handleCallbackQuery(cb: TelegramCallbackQuery): Promise<void> {
  const data = cb.data ?? '';
  const chatId = cb.message?.chat.id;
  const messageId = cb.message?.message_id;

  if (!chatId || !messageId) {
    await answerCallbackQuery(cb.id);
    return;
  }

  if (data.startsWith('ocr:')) {
    await handleOcrCallback(cb.id, chatId, messageId, data.slice(4));
    return;
  }

  // Unknown callback — acknowledge supaya tombol gak loading
  await answerCallbackQuery(cb.id);
}

async function handleOcrCallback(
  cbId: string,
  chatId: number,
  messageId: number,
  action: string
): Promise<void> {
  const admin = createAdminClient();

  const { data: conn } = await admin
    .from('telegram_connections')
    .select('user_id, default_business_id, default_transaction_status, pending_transaction, pending_expires_at')
    .eq('telegram_chat_id', chatId)
    .single();

  if (!conn) {
    await answerCallbackQuery(cbId, 'Akun belum terhubung');
    return;
  }

  const pending = conn.pending_transaction as unknown as PendingOcrDraft | null;
  const expired = !conn.pending_expires_at || new Date(conn.pending_expires_at) <= new Date();

  if (!pending || pending._type !== 'ocr_draft' || expired) {
    await answerCallbackQuery(cbId, 'Draft sudah kadaluarsa');
    await editMessageText(chatId, messageId, '⌛ Draft sudah kadaluarsa. Kirim ulang foto struknya.');
    return;
  }

  if (action === 'cancel') {
    await admin
      .from('telegram_connections')
      .update({ pending_transaction: null, pending_expires_at: null })
      .eq('telegram_chat_id', chatId);
    await answerCallbackQuery(cbId, 'Dibatalkan');
    await editMessageText(chatId, messageId, '❌ Draft transaksi dibatalkan.');
    return;
  }

  if (action === 'save') {
    if (!pending.total) {
      await answerCallbackQuery(cbId, 'Tidak ada nominal');
      await editMessageText(
        chatId,
        messageId,
        '❌ Tidak ada nominal yang berhasil dibaca. Kirim foto lebih jelas atau input manual.'
      );
      return;
    }
    if (!conn.default_business_id) {
      await answerCallbackQuery(cbId, 'Pilih bisnis dulu');
      return;
    }

    const status: 'draft' | 'posted' =
      conn.default_transaction_status === 'posted' ? 'posted' : 'draft';

    await answerCallbackQuery(cbId, 'Menyimpan...');
    await saveOcrTransaction(
      chatId,
      messageId,
      conn.user_id,
      conn.default_business_id,
      pending,
      status
    );
    await admin
      .from('telegram_connections')
      .update({ pending_transaction: null, pending_expires_at: null })
      .eq('telegram_chat_id', chatId);
    return;
  }

  await answerCallbackQuery(cbId);
}

async function saveOcrTransaction(
  chatId: number,
  messageId: number,
  userId: string,
  businessId: string,
  draft: PendingOcrDraft,
  status: 'draft' | 'posted'
): Promise<void> {
  const admin = createAdminClient();

  // Verifikasi role
  const { data: role } = await admin
    .from('user_business_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('business_id', businessId)
    .single();

  if (!role || !['business_manager', 'superadmin'].includes(role.role)) {
    await editMessageText(chatId, messageId, '❌ Kamu tidak punya akses mencatat transaksi di bisnis ini.');
    return;
  }

  // Cek period lock
  const today = new Date().toISOString().split('T')[0];
  const { data: biz } = await admin
    .from('businesses')
    .select('business_name, closed_until_date')
    .eq('id', businessId)
    .single();

  if (biz?.closed_until_date && today <= biz.closed_until_date) {
    await editMessageText(
      chatId,
      messageId,
      `❌ Periode hingga ${biz.closed_until_date} sudah dikunci.`
    );
    return;
  }

  // Resolve double-entry pakai vendor + assume OPEX default kalau gak ada hint
  const { data: accounts } = await admin
    .from('accounts')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true);

  const vendorName = draft.vendor ?? 'Pembelian struk';
  const resolved = smartResolveTransaction(vendorName, accounts ?? [], 'OPEX');
  const isDoubleEntry = !!(resolved.debit_account_id && resolved.credit_account_id);

  const { error } = await admin.from('transactions').insert({
    business_id: businessId,
    date: draft.date ?? today,
    category: resolved.category,
    name: 'Via AxionBot (OCR)',
    amount: draft.total!,
    description: vendorName,
    account: '',
    status,
    created_by: userId,
    debit_account_id: resolved.debit_account_id || null,
    credit_account_id: resolved.credit_account_id || null,
    is_double_entry: isDoubleEntry,
    meta: {
      source: 'telegram_ocr',
      ocr: {
        provider: draft.provider,
        raw_text: draft.raw_text,
      },
    },
  });

  if (error) {
    console.error('[telegram] insert OCR transaction error:', error);
    await editMessageText(chatId, messageId, '❌ Gagal menyimpan transaksi. Coba lagi nanti.');
    return;
  }

  await editMessageText(
    chatId,
    messageId,
    formatOcrSaved(draft.total!, draft.vendor, status),
    { parse_mode: 'Markdown' }
  );
}
