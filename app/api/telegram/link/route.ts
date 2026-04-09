import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createServerClient } from '@/lib/supabase-server';

// GET — cek status koneksi Telegram user saat ini
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServerClient();
  const { data } = await supabase
    .from('telegram_connections')
    .select('telegram_username, telegram_first_name, default_business_id, is_active, created_at')
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({ connection: data ?? null });
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
