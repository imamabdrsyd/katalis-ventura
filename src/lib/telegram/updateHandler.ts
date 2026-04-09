import { createAdminClient } from '@/lib/supabase-server';
import { sendMessage } from './api';
import {
  handleStartCommand,
  handleLinkWithToken,
  handleSaldoCommand,
  handleBisnisCommand,
  handleHelpCommand,
} from './commands';
import { parseTransactionMessage } from './parser';
import {
  formatTransactionConfirmation,
  formatTransactionSaved,
  formatHelp,
} from './formatter';
import { TelegramUpdate, ParsedTransaction } from './types';

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message ?? update.edited_message;
  if (!message?.text) return;

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
      case '/help':  await handleHelpCommand(chatId); break;
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
    .select('user_id, default_business_id, pending_transaction, pending_expires_at')
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
    if (['ya', 'y', 'yes', 'iya', 'ok', 'oke'].includes(lower)) {
      await saveTransaction(chatId, conn.user_id, conn.default_business_id, pending as ParsedTransaction);
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
    // Jika bukan ya/tidak, proses sebagai transaksi baru (fall through)
  }

  if (!conn.default_business_id) {
    await sendMessage(chatId, 'Belum ada bisnis aktif. Ketik /bisnis untuk memilih bisnis.');
    return;
  }

  const parsed = parseTransactionMessage(text);
  if (!parsed) {
    await sendMessage(
      chatId,
      `Tidak bisa membaca transaksi. Pastikan format:\n_deskripsi jumlah_\n\nContoh: \`jual kopi 150000\`\n\nKetik /help untuk panduan.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

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
  parsed: ParsedTransaction
): Promise<void> {
  const admin = createAdminClient();

  if (!businessId) {
    await sendMessage(chatId, '❌ Tidak ada bisnis aktif. Ketik /bisnis untuk memilih.');
    return;
  }

  // Verifikasi role (business_manager atau both)
  const { data: role } = await admin
    .from('user_business_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('business_id', businessId)
    .single();

  if (!role || !['business_manager', 'both'].includes(role.role)) {
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

  const { error } = await admin.from('transactions').insert({
    business_id: businessId,
    date: today,
    category: parsed.category,
    name: 'Via AxionBot',
    amount: parsed.amount,
    description: parsed.name,
    account: '',
    status: 'draft',
    created_by: userId,
  });

  if (error) {
    console.error('[telegram] insert transaction error:', error);
    await sendMessage(chatId, '❌ Gagal menyimpan transaksi. Coba lagi nanti.');
    return;
  }

  await sendMessage(
    chatId,
    formatTransactionSaved(parsed.name, parsed.amount, parsed.category, biz?.business_name ?? 'Bisnis'),
    { parse_mode: 'Markdown' }
  );
}
