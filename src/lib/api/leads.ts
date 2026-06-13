import { createClient } from '@/lib/supabase';
import type { AiMode, Lead, LeadChannel, LeadMessage, LeadStatus } from '@/types';

export interface LeadFilters {
  channel?: LeadChannel | '';
  status?: LeadStatus | '';
}

/** Status koneksi channel untuk indikator inbox — hanya kolom non-rahasia (tanpa token). */
export interface ChannelStatus {
  channel: LeadChannel;
  is_active: boolean;
  ai_enabled: boolean;
  ai_mode: AiMode;
}

/** Daftar integrasi channel bisnis (tanpa config/token). RLS batasi ke member bisnis. */
export async function getChannelStatuses(businessId: string): Promise<ChannelStatus[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('channel_integrations')
    .select('channel, is_active, ai_enabled, ai_mode')
    .eq('business_id', businessId)
    .is('deleted_at', null);

  if (error) throw new Error(error.message);
  return (data ?? []) as ChannelStatus[];
}

/** Ambil leads bisnis, terbaru dulu (by last_message_at). RLS enforce akses. */
export async function getLeads(businessId: string, filters: LeadFilters = {}): Promise<Lead[]> {
  const supabase = createClient();
  let query = supabase
    .from('leads')
    .select('*')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (filters.channel) query = query.eq('channel', filters.channel);
  if (filters.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as Lead[];
}

/** Riwayat percakapan satu lead, kronologis. */
export async function getLeadMessages(leadId: string): Promise<LeadMessage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('lead_messages')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data as LeadMessage[];
}

export async function updateLeadStatus(leadId: string, status: LeadStatus): Promise<Lead> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('leads')
    .update({ status })
    .eq('id', leadId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Lead;
}

/**
 * Approve draft AI: tandai sudah dikirim manual lewat platform OTA.
 * meta lama di-spread supaya provider/model tetap tercatat.
 */
export async function approveDraftMessage(message: LeadMessage): Promise<LeadMessage> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('lead_messages')
    .update({
      meta: {
        ...(message.meta ?? {}),
        is_draft: false,
        approved_at: new Date().toISOString(),
      },
    })
    .eq('id', message.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as LeadMessage;
}

/** Buang draft AI yang ditolak manager. */
export async function discardDraftMessage(messageId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('lead_messages').delete().eq('id', messageId);
  if (error) throw new Error(error.message);
}

/** Kirim balasan manual WhatsApp via server route (butuh Graph API token di server). */
export async function sendWhatsAppReply(leadId: string, message: string): Promise<LeadMessage> {
  const res = await fetch('/api/leads/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lead_id: leadId, message }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? 'Gagal mengirim balasan');
  }
  return json.data as LeadMessage;
}
