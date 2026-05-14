import { createAdminClient } from '@/lib/supabase-server';
import { sendMessage } from './api';
import {
  formatBalanceSummary,
  formatBusinessList,
  formatHelp,
  BalanceSummary,
} from './formatter';
import { TelegramUser } from './types';

export async function handleStartCommand(
  chatId: number,
  args: string,
  from: TelegramUser | undefined
): Promise<void> {
  const admin = createAdminClient();

  // Jika ada token argument, proses linking
  if (args.trim()) {
    await handleLinkWithToken(chatId, args.trim(), from);
    return;
  }

  // Cek apakah sudah terhubung
  const { data: conn } = await admin
    .from('telegram_connections')
    .select('user_id, telegram_first_name')
    .eq('telegram_chat_id', chatId)
    .single();

  if (conn) {
    await sendMessage(
      chatId,
      `Halo ${conn.telegram_first_name || 'Kamu'}! 👋\n\nAkun Telegram kamu sudah terhubung ke *AXION*.\n\nKetik /help untuk melihat cara penggunaan.`,
      { parse_mode: 'Markdown' }
    );
  } else {
    await sendMessage(
      chatId,
      `Halo! 👋 Selamat datang di *AXION Bot*.\n\nUntuk mulai menggunakan bot ini, hubungkan akun AXION kamu:\n\n1. Buka aplikasi AXION\n2. Pergi ke *Pengaturan*\n3. Klik *Hubungkan Telegram*\n4. Tap link yang muncul\n\nAtau kirim \`/link TOKEN\` jika sudah punya token.`,
      { parse_mode: 'Markdown' }
    );
  }
}

export async function handleLinkWithToken(
  chatId: number,
  token: string,
  from: TelegramUser | undefined
): Promise<void> {
  const admin = createAdminClient();

  // Cek apakah token valid
  const { data: linkToken } = await admin
    .from('telegram_link_tokens')
    .select('id, user_id, expires_at, used_at')
    .eq('token', token)
    .single();

  if (!linkToken) {
    await sendMessage(chatId, '❌ Token tidak valid. Buat token baru di Pengaturan aplikasi AXION.');
    return;
  }

  if (linkToken.used_at) {
    await sendMessage(chatId, '❌ Token ini sudah pernah digunakan. Buat token baru di Pengaturan.');
    return;
  }

  if (new Date(linkToken.expires_at) < new Date()) {
    await sendMessage(chatId, '❌ Token sudah kadaluarsa. Buat token baru di Pengaturan.');
    return;
  }

  // Cek apakah chat_id ini sudah terhubung ke akun lain
  const { data: existingConn } = await admin
    .from('telegram_connections')
    .select('user_id')
    .eq('telegram_chat_id', chatId)
    .single();

  if (existingConn && existingConn.user_id !== linkToken.user_id) {
    await sendMessage(chatId, '❌ Akun Telegram ini sudah terhubung ke akun AXION lain.');
    return;
  }

  // Ambil bisnis default (bisnis pertama milik user)
  const { data: roles } = await admin
    .from('user_business_roles')
    .select('business_id, businesses(business_name)')
    .eq('user_id', linkToken.user_id)
    .in('role', ['business_manager', 'superadmin'])
    .limit(1);

  const defaultBusinessId = roles?.[0]?.business_id ?? null;
  if (!defaultBusinessId) {
    await sendMessage(chatId, '❌ Telegram Bot hanya tersedia untuk Business Manager dan Super Admin.');
    return;
  }

  // Upsert koneksi
  await admin.from('telegram_connections').upsert(
    {
      user_id: linkToken.user_id,
      telegram_chat_id: chatId,
      telegram_username: from?.username ?? null,
      telegram_first_name: from?.first_name ?? null,
      default_business_id: defaultBusinessId,
      is_active: true,
      pending_transaction: null,
      pending_expires_at: null,
    },
    { onConflict: 'user_id' }
  );

  // Tandai token sebagai sudah dipakai
  await admin
    .from('telegram_link_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', linkToken.id);

  const firstName = from?.first_name ?? 'Kamu';
  await sendMessage(
    chatId,
    `✅ Berhasil! Halo *${firstName}*!\n\nAkun AXION kamu sudah terhubung ke Telegram.\n\nSekarang kamu bisa input transaksi langsung dari sini.\nContoh: \`jual kopi 150000\`\n\nKetik /help untuk panduan lengkap.`,
    { parse_mode: 'Markdown' }
  );
}

export async function handleSaldoCommand(chatId: number): Promise<void> {
  const admin = createAdminClient();

  const { data: conn } = await admin
    .from('telegram_connections')
    .select('user_id, default_business_id')
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

  // Fetch business name
  const { data: biz } = await admin
    .from('businesses')
    .select('business_name')
    .eq('id', conn.default_business_id)
    .single();

  // Fetch semua transaksi aktif bisnis ini
  const { data: transactions } = await admin
    .from('active_transactions')
    .select('category, amount')
    .eq('business_id', conn.default_business_id);

  if (!transactions) {
    await sendMessage(chatId, 'Gagal mengambil data transaksi.');
    return;
  }

  const summary: BalanceSummary = {
    businessName: biz?.business_name ?? 'Bisnis',
    totalEarn: 0,
    totalOpex: 0,
    totalVar: 0,
    totalCapex: 0,
    totalTax: 0,
    totalFin: 0,
  };

  for (const tx of transactions) {
    switch (tx.category) {
      case 'EARN':  summary.totalEarn  += tx.amount; break;
      case 'OPEX':  summary.totalOpex  += tx.amount; break;
      case 'VAR':   summary.totalVar   += tx.amount; break;
      case 'CAPEX': summary.totalCapex += tx.amount; break;
      case 'TAX':   summary.totalTax   += tx.amount; break;
      case 'FIN':   summary.totalFin   += tx.amount; break;
    }
  }

  await sendMessage(chatId, formatBalanceSummary(summary), { parse_mode: 'Markdown' });
}

export async function handleBisnisCommand(chatId: number): Promise<void> {
  const admin = createAdminClient();

  const { data: conn } = await admin
    .from('telegram_connections')
    .select('user_id, default_business_id')
    .eq('telegram_chat_id', chatId)
    .single();

  if (!conn) {
    await sendMessage(chatId, 'Akun belum terhubung. Ketik /start untuk instruksi.');
    return;
  }

  const { data: roles } = await admin
    .from('user_business_roles')
    .select('business_id, businesses(id, business_name)')
    .eq('user_id', conn.user_id)
    .in('role', ['business_manager', 'superadmin']);

  if (!roles || roles.length === 0) {
    await sendMessage(chatId, 'Kamu belum punya bisnis. Buat bisnis di aplikasi AXION terlebih dahulu.');
    return;
  }

  const businesses = roles
    .map((r) => {
      const biz = r.businesses as unknown as { id: string; business_name: string } | null;
      return biz;
    })
    .filter((b): b is { id: string; business_name: string } => b !== null);

  if (businesses.length === 1) {
    // Auto set jika hanya 1 bisnis
    await admin
      .from('telegram_connections')
      .update({ default_business_id: businesses[0].id })
      .eq('telegram_chat_id', chatId);

    await sendMessage(
      chatId,
      `🏢 Bisnis aktif: *${businesses[0].business_name}*`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Simpan state pemilihan bisnis sebagai pending khusus
  await admin
    .from('telegram_connections')
    .update({
      pending_transaction: { _type: 'bisnis_selection', businesses },
      pending_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    })
    .eq('telegram_chat_id', chatId);

  await sendMessage(
    chatId,
    formatBusinessList(businesses, conn.default_business_id),
    { parse_mode: 'Markdown' }
  );
}

export async function handleHelpCommand(chatId: number): Promise<void> {
  await sendMessage(chatId, formatHelp(), { parse_mode: 'Markdown' });
}

export async function handleSettingCommand(chatId: number): Promise<void> {
  const admin = createAdminClient();

  const { data: conn } = await admin
    .from('telegram_connections')
    .select('default_business_id, default_transaction_status')
    .eq('telegram_chat_id', chatId)
    .single();

  if (!conn) {
    await sendMessage(chatId, 'Akun belum terhubung. Ketik /start untuk instruksi.');
    return;
  }

  let businessName = '_(belum dipilih)_';
  if (conn.default_business_id) {
    const { data: biz } = await admin
      .from('businesses')
      .select('business_name')
      .eq('id', conn.default_business_id)
      .single();
    if (biz) businessName = biz.business_name;
  }

  const statusLabel = conn.default_transaction_status === 'posted'
    ? '✅ Posted _(langsung final)_'
    : '📝 Draft _(perlu review)_';

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://axion.app';

  await sendMessage(
    chatId,
    `⚙️ *Pengaturan Telegram Bot*\n\n🏢 *Bisnis aktif:* ${businessName}\n📌 *Status transaksi:* ${statusLabel}\n\nUntuk mengubah, buka:\n${appUrl}/settings`,
    { parse_mode: 'Markdown' }
  );
}
