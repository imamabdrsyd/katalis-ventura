/**
 * Handler DM masuk Instagram — dipanggil dari webhook route.
 *
 * Alur per pesan (mirror WhatsApp handler, reuse helper leads):
 * 1. Skip echo (pesan yang dikirim akun bisnis sendiri) → hindari loop
 * 2. Lookup bisnis dari recipient.id (IGSID akun bisnis) di channel_integrations
 * 3. Upsert lead by (business_id, 'instagram', sender.id)
 * 4. Simpan inbound ke lead_messages (dedup by mid)
 * 5. Kalau ai_enabled: generate balasan
 *    - ai_mode='auto'  → decrypt token bisnis → kirim DM → simpan outbound (sender='ai')
 *    - ai_mode='draft' → simpan outbound (sender='ai', meta.is_draft=true), JANGAN kirim
 *
 * Error di-log saja, tidak throw — webhook harus selalu balas 200.
 */

import { createAdminClient } from '@/lib/supabase-server';
import {
  fetchLeadHistoryForAI,
  findActiveIntegration,
  insertLeadMessage,
  upsertLead,
} from '@/lib/leads';
import { generateLeadReply } from '@/lib/ai/leadAssistant';
import { getDecryptedToken } from '@/lib/integrations/config';
import { sendInstagramMessage, getInstagramSenderName } from './api';
import type { InstagramWebhookEntry, InstagramMessaging } from './types';
import type { ChannelIntegration } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function handleInstagramEntry(entry: InstagramWebhookEntry): Promise<void> {
  const events = entry.messaging ?? [];
  if (events.length === 0) return; // bukan event pesan — abaikan

  const supabase = createAdminClient();

  // Lookup bisnis dari ID akun Instagram (entry.id = recipient.id akun bisnis)
  const integration = await findActiveIntegration(supabase, {
    channel: 'instagram',
    externalAccountId: entry.id,
  });
  if (!integration) {
    console.warn('[instagram/handler] tidak ada integrasi aktif untuk ig account:', entry.id);
    return;
  }

  for (const event of events) {
    try {
      await processEvent(supabase, integration.business_id, integration, event);
    } catch (err) {
      console.error('[instagram/handler] error memproses event:', event.message?.mid, err);
    }
  }
}

async function processEvent(
  supabase: SupabaseClient,
  businessId: string,
  integration: ChannelIntegration,
  event: InstagramMessaging
): Promise<void> {
  const message = event.message;
  // Skip echo (pesan kita sendiri) & event non-pesan (read/reaction/dll)
  if (!message || message.is_echo) return;

  const senderId = event.sender?.id;
  if (!senderId) return;

  // Coba lookup nama/username via Graph API — gagal → fallback @senderId.
  const businessToken = getDecryptedToken(integration);
  const senderName =
    (businessToken ? await getInstagramSenderName(businessToken, senderId) : null) ??
    `@${senderId}`;

  // 1. Upsert lead
  const lead = await upsertLead(supabase, {
    businessId,
    channel: 'instagram',
    externalId: senderId,
    name: senderName,
    lastMessageAt: new Date(event.timestamp || Date.now()).toISOString(),
  });
  if (!lead) return;

  // 2. Simpan inbound (dedup by mid). Pesan non-teks → placeholder.
  const content = message.text ?? '[pesan instagram]';
  const saved = await insertLeadMessage(supabase, {
    leadId: lead.id,
    businessId,
    direction: 'inbound',
    sender: 'customer',
    content,
    externalMessageId: message.mid,
  });
  if (!saved) return;

  // 3. AI — hanya untuk pesan teks
  if (!integration.ai_enabled || !message.text) return;

  const history = await fetchLeadHistoryForAI(supabase, lead.id);
  const result = await generateLeadReply(supabase, integration, lead, history);
  if (!result) return;

  if (integration.ai_mode === 'auto') {
    const token = getDecryptedToken(integration);
    if (!token) {
      console.warn('[instagram/handler] token bisnis tidak tersedia — simpan draft');
    } else {
      const sent = await sendInstagramMessage(token, senderId, result.reply);
      if (sent.ok) {
        await insertLeadMessage(supabase, {
          leadId: lead.id,
          businessId,
          direction: 'outbound',
          sender: 'ai',
          content: result.reply,
          externalMessageId: sent.messageId ?? null,
          meta: { provider: result.provider, model: result.model },
        });
        return;
      }
      console.warn('[instagram/handler] kirim balasan gagal:', sent.error);
    }
  }

  // ai_mode='draft' ATAU auto yang gagal kirim → simpan sebagai draft
  await insertLeadMessage(supabase, {
    leadId: lead.id,
    businessId,
    direction: 'outbound',
    sender: 'ai',
    content: result.reply,
    meta: { provider: result.provider, model: result.model, is_draft: true },
  });
}
