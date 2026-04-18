import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createServerClient } from '@/lib/supabase-server';

// GET — cek status koneksi Telegram user saat ini
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServerClient();
  const { data } = await supabase
    .from('telegram_connections')
    .select('telegram_username, telegram_first_name, default_business_id, default_transaction_status, is_active, created_at')
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({ connection: data ?? null });
}

// PATCH — update preferensi (default_transaction_status)
export async function PATCH(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const status = body?.default_transaction_status;
  if (status !== 'draft' && status !== 'posted') {
    return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from('telegram_connections')
    .update({ default_transaction_status: status })
    .eq('user_id', user.id);

  if (error) {
    console.error('[telegram/link] update setting error:', error);
    return NextResponse.json({ error: 'Gagal menyimpan preferensi' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, default_transaction_status: status });
}

// POST — generate link token baru
export async function POST() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServerClient();

  // Hapus token lama yang sudah kadaluarsa milik user ini
  await supabase
    .from('telegram_link_tokens')
    .delete()
    .eq('user_id', user.id)
    .lt('expires_at', new Date().toISOString());

  // Buat token baru
  const { data, error } = await supabase
    .from('telegram_link_tokens')
    .insert({ user_id: user.id })
    .select('token, expires_at')
    .single();

  if (error) {
    console.error('[telegram/link] insert token error:', error);
    return NextResponse.json({ error: 'Gagal membuat token' }, { status: 500 });
  }

  return NextResponse.json({
    token: data.token,
    expires_at: data.expires_at,
    bot_username: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? '',
  });
}

// DELETE — putuskan koneksi Telegram
export async function DELETE(_request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServerClient();
  const { error } = await supabase
    .from('telegram_connections')
    .delete()
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Gagal memutuskan koneksi' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
