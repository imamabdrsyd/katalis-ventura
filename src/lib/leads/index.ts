/**
 * Helper bersama Leads Hub — dipakai webhook WhatsApp (Fase 2) dan
 * generic inbound webhook Zapier/Make (Fase 3).
 *
 * Semua fungsi menerima Supabase client dari caller (webhook pakai
 * createAdminClient — service role, bypass RLS).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChannelIntegration, Lead, LeadChannel, LeadMessage } from '@/types';
import type { AIMessage } from '@/lib/ai/provider';

/**
 * Cari integrasi aktif untuk sebuah bisnis + channel.
 * Return null kalau tidak ada / nonaktif.
 */
export async function findActiveIntegration(
  supabase: SupabaseClient,
  filter: { businessId?: string; channel: LeadChannel; externalAccountId?: string }
): Promise<ChannelIntegration | null> {
  let query = supabase
    .from('channel_integrations')
    .select('*')
    .eq('channel', filter.channel)
    .eq('is_active', true)
    .is('deleted_at', null);

  if (filter.businessId) query = query.eq('business_id', filter.businessId);
  if (filter.externalAccountId) query = query.eq('external_account_id', filter.externalAccountId);

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) {
    console.warn('[leads] findActiveIntegration error:', error.message);
    return null;
  }
  return data as ChannelIntegration | null;
}

export interface UpsertLeadParams {
  businessId: string;
  channel: LeadChannel;
  externalId: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  /** ISO timestamp pesan terakhir — default now() */
  lastMessageAt?: string;
}

/**
 * Manual upsert lead by (business_id, channel, external_id).
 * Select dulu lalu insert/update — hindari ON CONFLICT yang tidak bisa
 * memakai partial unique index (WHERE deleted_at IS NULL) via PostgREST.
 */
export async function upsertLead(
  supabase: SupabaseClient,
  params: UpsertLeadParams
): Promise<Lead | null> {
  const lastMessageAt = params.lastMessageAt ?? new Date().toISOString();

  const { data: existing, error: selectError } = await supabase
    .from('leads')
    .select('*')
    .eq('business_id', params.businessId)
    .eq('channel', params.channel)
    .eq('external_id', params.externalId)
    .is('deleted_at', null)
    .maybeSingle();

  if (selectError) {
    console.warn('[leads] upsertLead select error:', selectError.message);
    return null;
  }

  if (existing) {
    // Isi field identitas hanya kalau masih kosong — jangan timpa
    // data yang sudah dirapikan manager di inbox.
    const updates: Record<string, unknown> = { last_message_at: lastMessageAt };
    if (params.name && !existing.name) updates.name = params.name;
    if (params.phone && !existing.phone) updates.phone = params.phone;
    if (params.email && !existing.email) updates.email = params.email;

    const { data: updated, error: updateError } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single();

    if (updateError) {
      console.warn('[leads] upsertLead update error:', updateError.message);
      return existing as Lead;
    }
    return updated as Lead;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('leads')
    .insert({
      business_id: params.businessId,
      channel: params.channel,
      external_id: params.externalId,
      name: params.name ?? null,
      phone: params.phone ?? null,
      email: params.email ?? null,
      status: 'new',
      last_message_at: lastMessageAt,
    })
    .select()
    .single();

  if (insertError) {
    console.warn('[leads] upsertLead insert error:', insertError.message);
    return null;
  }
  return inserted as Lead;
}

export interface InsertLeadMessageParams {
  leadId: string;
  businessId: string;
  direction: 'inbound' | 'outbound';
  sender: 'customer' | 'ai' | 'human';
  content: string;
  externalMessageId?: string | null;
  meta?: Record<string, unknown> | null;
}

/**
 * Simpan pesan dengan dedup: kalau external_message_id sudah ada untuk bisnis
 * ini (webhook retry), skip dan return null.
 */
export async function insertLeadMessage(
  supabase: SupabaseClient,
  params: InsertLeadMessageParams
): Promise<LeadMessage | null> {
  if (params.externalMessageId) {
    const { data: dup } = await supabase
      .from('lead_messages')
      .select('id')
      .eq('business_id', params.businessId)
      .eq('external_message_id', params.externalMessageId)
      .limit(1)
      .maybeSingle();

    if (dup) {
      console.info('[leads] skip duplicate message:', params.externalMessageId);
      return null;
    }
  }

  const { data, error } = await supabase
    .from('lead_messages')
    .insert({
      lead_id: params.leadId,
      business_id: params.businessId,
      direction: params.direction,
      sender: params.sender,
      content: params.content,
      external_message_id: params.externalMessageId ?? null,
      meta: params.meta ?? null,
    })
    .select()
    .single();

  if (error) {
    console.warn('[leads] insertLeadMessage error:', error.message);
    return null;
  }
  return data as LeadMessage;
}

/**
 * Ambil riwayat percakapan lead (kronologis) sebagai AIMessage[] untuk
 * context AI. Draft AI yang belum di-approve tidak diikutkan.
 * Pesan beruntun dengan role sama digabung (Gemini menyarankan alternating).
 */
export async function fetchLeadHistoryForAI(
  supabase: SupabaseClient,
  leadId: string,
  limit = 20
): Promise<AIMessage[]> {
  const { data, error } = await supabase
    .from('lead_messages')
    .select('sender, content, meta, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) {
    if (error) console.warn('[leads] fetchLeadHistoryForAI error:', error.message);
    return [];
  }

  const chronological = [...data].reverse().filter(
    (m) => !(m.meta as { is_draft?: boolean } | null)?.is_draft
  );

  const messages: AIMessage[] = [];
  for (const m of chronological) {
    const role = m.sender === 'customer' ? 'user' : 'assistant';
    const last = messages[messages.length - 1];
    if (last && last.role === role) {
      last.content += `\n${m.content}`;
    } else {
      messages.push({ role, content: m.content });
    }
  }
  return messages;
}
