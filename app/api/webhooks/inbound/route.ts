import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';
import { inboundWebhookSchema } from '@/lib/validations';
import {
  fetchLeadHistoryForAI,
  findActiveIntegration,
  insertLeadMessage,
  upsertLead,
} from '@/lib/leads';
import { generateLeadReply } from '@/lib/ai/leadAssistant';
import { withRouteTiming } from '@/lib/api/server/timing';

/**
 * Generic inbound webhook — receiver dari Zapier/Make untuk channel tanpa
 * API langsung (Airbnb, Booking.com, dll).
 *
 * Body ternormalisasi (dimapping di Zapier/Make):
 *   { business_id, channel, external_id, name?, message, contact? }
 *
 * Balasan AI di channel OTA selalu DRAFT (meta.is_draft=true) — platform
 * tidak mengizinkan auto-send, manager approve manual dari inbox.
 */

// Timing-safe compare; fail closed kalau secret belum di-set.
function verifySecret(received: string | null): boolean {
  const expected = process.env.WEBHOOK_INBOUND_SECRET;
  if (!expected) {
    console.warn('[webhooks/inbound] WEBHOOK_INBOUND_SECRET belum di-set — tolak semua POST');
    return false;
  }
  if (!received || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

async function handleInboundPost(request: NextRequest) {
  if (!verifySecret(request.headers.get('x-webhook-secret'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = inboundWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const supabase = createAdminClient();

  // Integrasi harus terdaftar & aktif — mencegah payload nyasar ke bisnis
  // yang tidak mengaktifkan channel ini.
  const integration = await findActiveIntegration(supabase, {
    businessId: input.business_id,
    channel: input.channel,
  });
  if (!integration) {
    return NextResponse.json(
      { error: `Tidak ada integrasi aktif untuk channel ${input.channel} di bisnis ini` },
      { status: 422 }
    );
  }

  const lead = await upsertLead(supabase, {
    businessId: input.business_id,
    channel: input.channel,
    externalId: input.external_id,
    name: input.name ?? null,
    phone: input.contact?.phone ?? null,
    email: input.contact?.email ?? null,
  });
  if (!lead) {
    return NextResponse.json({ error: 'Gagal menyimpan lead' }, { status: 500 });
  }

  const saved = await insertLeadMessage(supabase, {
    leadId: lead.id,
    businessId: input.business_id,
    direction: 'inbound',
    sender: 'customer',
    content: input.message,
  });

  // Draft balasan AI — disimpan saja, JANGAN dikirim ke mana pun.
  // Status lead tetap 'new' sampai manager menindaklanjuti.
  let draftCreated = false;
  if (saved && integration.ai_enabled && integration.ai_mode === 'draft') {
    try {
      const history = await fetchLeadHistoryForAI(supabase, lead.id);
      const result = await generateLeadReply(supabase, integration, lead, history);
      if (result) {
        const draft = await insertLeadMessage(supabase, {
          leadId: lead.id,
          businessId: input.business_id,
          direction: 'outbound',
          sender: 'ai',
          content: result.reply,
          meta: { is_draft: true, provider: result.provider, model: result.model },
        });
        draftCreated = draft !== null;
      }
    } catch (err) {
      // Draft gagal bukan alasan menolak webhook — pesan inbound sudah tersimpan.
      console.error('[webhooks/inbound] gagal generate draft AI:', err);
    }
  }

  return NextResponse.json({ ok: true, lead_id: lead.id, draft_created: draftCreated });
}

export async function POST(request: NextRequest) {
  return withRouteTiming(request, '/api/webhooks/inbound', () => handleInboundPost(request));
}
