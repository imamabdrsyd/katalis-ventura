import { NextRequest, NextResponse } from 'next/server';
import { handleTelegramUpdate } from '@/lib/telegram';
import { TelegramUpdate } from '@/lib/telegram/types';
import { withRouteTiming } from '@/lib/api/server/timing';

const BOT_API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// GET ?action=status  — cek status webhook saat ini
// GET ?action=setup   — daftarkan webhook ke Telegram (panggil sekali setelah deploy)
// Semua dilindungi header x-admin-secret = TELEGRAM_WEBHOOK_SECRET
async function handleWebhookGet(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const action = request.nextUrl.searchParams.get('action') ?? 'status';

  if (action === 'setup') {
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://axionventura.com'}/api/telegram/webhook`;
    const res = await fetch(`${BOT_API()}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
        allowed_updates: ['message', 'edited_message'],
      }),
    });
    const data = await res.json();
    return NextResponse.json({ action: 'setup', webhookUrl, result: data });
  }

  // default: status
  const res = await fetch(`${BOT_API()}/getWebhookInfo`);
  const data = await res.json();
  return NextResponse.json({ action: 'status', result: data });
}

async function handleWebhookPost(request: NextRequest) {
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

export async function GET(request: NextRequest) {
  return withRouteTiming(request, '/api/telegram/webhook', () => handleWebhookGet(request));
}

export async function POST(request: NextRequest) {
  return withRouteTiming(request, '/api/telegram/webhook', () => handleWebhookPost(request));
}
