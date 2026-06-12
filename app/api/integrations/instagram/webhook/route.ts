import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { handleInstagramEntry } from '@/lib/instagram';
import type { InstagramWebhookPayload } from '@/lib/instagram';
import { withRouteTiming } from '@/lib/api/server/timing';

// GET — verifikasi webhook saat setup di Meta App Dashboard.
// Meta kirim hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
// dan mengharapkan hub.challenge dibalas plain text 200.
function handleWebhookGet(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get('hub.mode');
  const verifyToken = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  const expectedToken = process.env.INSTAGRAM_VERIFY_TOKEN;
  if (!expectedToken || mode !== 'subscribe' || verifyToken !== expectedToken || !challenge) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return new NextResponse(challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

// Verifikasi X-Hub-Signature-256 = 'sha256=' + HMAC-SHA256(raw body, app secret).
// Timing-safe compare; fail closed kalau secret belum di-set.
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appSecret) {
    console.warn('[instagram/webhook] INSTAGRAM_APP_SECRET belum di-set — tolak semua POST');
    return false;
  }
  if (!signatureHeader?.startsWith('sha256=')) return false;

  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  const received = signatureHeader.slice('sha256='.length);
  if (received.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

async function handleWebhookPost(request: NextRequest) {
  // Raw body dibutuhkan untuk HMAC — parse JSON setelah signature valid.
  const rawBody = await request.text();

  if (!verifySignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  let payload: InstagramWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Selalu return 200 setelah signature valid — error dihandle internal (log),
  // supaya Meta tidak retry berlebihan (pola sama dengan WhatsApp webhook).
  try {
    for (const entry of payload.entry ?? []) {
      await handleInstagramEntry(entry);
    }
  } catch (err) {
    console.error('[instagram/webhook] unhandled error:', err);
  }

  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  return withRouteTiming(request, '/api/integrations/instagram/webhook', async () =>
    handleWebhookGet(request)
  );
}

export async function POST(request: NextRequest) {
  return withRouteTiming(request, '/api/integrations/instagram/webhook', () =>
    handleWebhookPost(request)
  );
}
