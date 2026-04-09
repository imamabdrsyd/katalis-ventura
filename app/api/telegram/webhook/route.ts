import { NextRequest, NextResponse } from 'next/server';
import { handleTelegramUpdate } from '@/lib/telegram';
import { TelegramUpdate } from '@/lib/telegram/types';

export async function POST(request: NextRequest) {
  // Verifikasi secret token dari Telegram
  const secret = request.headers.get('x-telegram-bot-api-secret-token');
  if (!secret || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Selalu return 200 agar Telegram tidak retry
  // Error dihandle internal (log saja)
  try {
    await handleTelegramUpdate(update);
  } catch (err) {
    console.error('[telegram/webhook] unhandled error:', err);
  }

  return NextResponse.json({ ok: true });
}
