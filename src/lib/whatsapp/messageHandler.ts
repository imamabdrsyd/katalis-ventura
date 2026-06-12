/**
 * Handler pesan masuk WhatsApp Cloud API — dipanggil dari webhook route.
 *
 * Alur per pesan:
 * 1. Lookup bisnis dari metadata.phone_number_id di channel_integrations
 * 2. Upsert lead by (business_id, 'whatsapp', wa_id pengirim)
 * 3. Simpan inbound ke lead_messages (dedup by wamid)
 * 4. Kalau ai_enabled: generate balasan AI
 *    - ai_mode='auto'  → kirim (token per-bisnis dari config, fallback env) → simpan outbound
 *    - ai_mode='draft' → simpan draft (meta.is_draft=true), manager approve di inbox
 *
 * Error di-log saja, tidak throw — webhook harus selalu balas 200 agar
 * Meta tidak retry berlebihan.
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
import { sendWhatsAppMessage, type WhatsAppCredentials } from './api';
import type { WhatsAppWebhookValue } from './types';
import type { ChannelIntegration } from '@/types';

/**
 * Susun kredensial kirim per-bisnis dari integration.config.
 * Return undefined kalau bisnis belum simpan token sendiri → caller
 * fallback ke env global (model lama).
 */
export function getWhatsAppCredentials(
  integration: ChannelIntegration
): WhatsAppCredentials | undefined {
  const accessToken = getDecryptedToken(integration);
  if (!accessToken || !integration.external_account_id) return undefined;
  return { phoneNumberId: integration.external_account_id, accessToken };
}

/** Konversi pesan non-teks jadi placeholder yang tetap tersimpan di riwayat. */
function extractContent(type: string, textBody?: string): string {
  if (type === 'text' && textBody) return textBody;
  return `[pesan ${type}]`;
}

export async function handleWhatsAppMessage(value: WhatsAppWebhookValue): Promise<void> {
  const messages = value.messages ?? [];
  if (messages.length === 0) return; // status update / payload lain — abaikan

  const phoneNumberId = value.metadata?.phone_number_id;
  if (!phoneNumberId) {
    console.warn('[whatsapp/handler] payload tanpa phone_number_id — skip');
    return;
  }

  const supabase = createAdminClient();

  // 1. Lookup bisnis dari phone_number_id
  const integration = await findActiveIntegration(supabase, {
    channel: 'whatsapp',
    externalAccountId: phoneNumberId,
  });
  if (!integration) {
    console.warn('[whatsapp/handler] tidak ada integrasi aktif untuk phone_number_id:', phoneNumberId);
    return;
  }

  for (const msg of messages) {
    try {
      // 2. Upsert lead — nama dari profil WA kalau ada
      const contactName = value.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name ?? null;
      const lead = await upsertLead(supabase, {
        businessId: integration.business_id,
        channel: 'whatsapp',
        externalId: msg.from,
        name: contactName,
        phone: msg.from,
        lastMessageAt: new Date(Number(msg.timestamp) * 1000 || Date.now()).toISOString(),
      });
      if (!lead) continue;

      // 3. Simpan inbound (dedup by wamid — null berarti duplikat/gagal)
      const content = extractContent(msg.type, msg.text?.body);
      const saved = await insertLeadMessage(supabase, {
        leadId: lead.id,
        businessId: integration.business_id,
        direction: 'inbound',
        sender: 'customer',
        content,
        externalMessageId: msg.id,
      });
      if (!saved) continue;

      // 4. AI — hanya untuk pesan teks
      if (integration.ai_enabled && msg.type === 'text') {
        const history = await fetchLeadHistoryForAI(supabase, lead.id);
        const result = await generateLeadReply(supabase, integration, lead, history);
        if (!result) continue;

        if (integration.ai_mode === 'auto') {
          // Token per-bisnis dari config; undefined → fallback env global
          const creds = getWhatsAppCredentials(integration);
          const sent = await sendWhatsAppMessage(msg.from, result.reply, creds);
          if (sent.ok) {
            await insertLeadMessage(supabase, {
              leadId: lead.id,
              businessId: integration.business_id,
              direction: 'outbound',
              sender: 'ai',
              content: result.reply,
              externalMessageId: sent.messageId ?? null,
              meta: { provider: result.provider, model: result.model },
            });
            continue;
          }
          console.warn('[whatsapp/handler] kirim balasan gagal:', sent.error);
        }

        // ai_mode='draft' ATAU auto yang gagal kirim → simpan sebagai draft
        await insertLeadMessage(supabase, {
          leadId: lead.id,
          businessId: integration.business_id,
          direction: 'outbound',
          sender: 'ai',
          content: result.reply,
          meta: { provider: result.provider, model: result.model, is_draft: true },
        });
      }
    } catch (err) {
      console.error('[whatsapp/handler] error memproses pesan:', msg.id, err);
    }
  }
}
