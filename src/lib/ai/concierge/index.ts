/**
 * Concierge-Pro — generate balasan lead tier premium.
 *
 * Signature & return IDENTIK dengan leadAssistant.generateLeadReply() supaya
 * 3 webhook caller (whatsapp/instagram/inbound) cukup bercabang satu baris.
 *
 * Perbedaan dari tier gratis:
 * - Persona CS terstruktur adaptif-sektor (lihat personas.ts), bukan prompt datar.
 * - Tenaga: Vertex (Claude → Gemini Vertex) sebagai PRIMARY, dengan FALLBACK
 *   otomatis ke chain gratis (Gemini key → Groq). Jadi saat kredit Vertex habis
 *   atau Vertex error, balasan TETAP keluar (turun kualitas, bukan mati).
 *
 * Tidak ada tool-calling — murni persona + konteks (katalog + business knowledge).
 * Tidak menyentuh leadAssistant.ts maupun provider.ts (hanya consume export-nya).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChannelIntegration, Lead } from '@/types';
import {
  generateText,
  generateTextClaude,
  generateTextGeminiVertex,
  isClaudeAvailable,
  AIProviderRequestError,
  type AIMessage,
  type GenerateResult,
} from '../provider';
import { buildConciergeSystemPrompt, type ConciergeCatalogItem } from './personas';

export interface LeadReplyResult {
  reply: string;
  provider: string;
  model: string;
}

/**
 * Gabungkan field terstruktur + catatan bebas jadi satu blok teks berlabel ID.
 * Diduplikasi dari leadAssistant.formatBusinessKnowledge agar tier gratis tetap beku.
 */
function formatBusinessKnowledge(
  fields: {
    hours?: string;
    location?: string;
    policies?: string;
    faq?: string;
    images?: { url: string; title: string }[];
  } | null,
  content: string | null
): string | null {
  const lines: string[] = [];
  if (fields?.hours?.trim()) lines.push(`Jam buka: ${fields.hours.trim()}`);
  if (fields?.location?.trim()) lines.push(`Lokasi: ${fields.location.trim()}`);
  if (fields?.policies?.trim()) lines.push(`Kebijakan: ${fields.policies.trim()}`);
  if (fields?.faq?.trim()) lines.push(`FAQ: ${fields.faq.trim()}`);
  if (fields?.images && fields.images.length > 0) {
    lines.push('Gambar/Foto Bisnis pendukung:');
    fields.images.forEach((img) => {
      lines.push(`- ${img.title}: ${img.url}`);
    });
  }
  if (content?.trim()) lines.push(content.trim());
  return lines.length > 0 ? lines.join('\n') : null;
}

/** Parse output model: JSON {"reply": ...} dengan fallback ke raw text. */
function parseReply(raw: string): string | null {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as { reply?: unknown };
    if (typeof parsed.reply === 'string' && parsed.reply.trim()) {
      return parsed.reply.trim();
    }
  } catch {
    // bukan JSON — pakai raw text apa adanya
  }
  return cleaned || null;
}

/**
 * Tenaga Concierge-Pro: Vertex primary + fallback chain gratis.
 * Tidak pernah throw — return null kalau semua jalur gagal (caller skip balasan).
 */
async function generateProText(
  systemPrompt: string,
  history: AIMessage[]
): Promise<GenerateResult | null> {
  const opts = { temperature: 0.5, maxTokens: 1024 };

  // 1. PRIMARY: Vertex — hanya bila kredensial tersedia.
  if (isClaudeAvailable()) {
    // 1a. Claude Sonnet (Vertex) — throw AIProviderRequestError saat gagal → tangkap & lanjut.
    try {
      const claude = await generateTextClaude(systemPrompt, history, opts);
      if (claude) return claude;
    } catch (err) {
      if (!(err instanceof AIProviderRequestError)) {
        console.warn('[ai/concierge] Claude error tak terduga:', err);
      }
      // lanjut ke jalur berikutnya
    }

    // 1b. Gemini Vertex — return null saat gagal (tidak throw).
    const gv = await generateTextGeminiVertex(systemPrompt, history, opts);
    if (gv) return gv;
  }

  // 2. FALLBACK: chain gratis (Gemini key → Groq) — sama dengan tier gratis.
  const free = await generateText(systemPrompt, history, opts);
  if (free) return free;

  return null;
}

/**
 * Generate balasan AI premium untuk lead.
 * `history` harus diakhiri pesan customer terbaru (role 'user').
 */
export async function generateConciergeReply(
  supabase: SupabaseClient,
  integration: ChannelIntegration,
  lead: Lead,
  history: AIMessage[]
): Promise<LeadReplyResult | null> {
  if (history.length === 0) return null;

  const [{ data: business }, { data: catalog }, { data: knowledge }] = await Promise.all([
    supabase
      .from('businesses')
      .select('business_name, business_sector')
      .eq('id', integration.business_id)
      .maybeSingle(),
    supabase
      .from('catalog_items')
      .select('name, default_price, unit, description')
      .eq('business_id', integration.business_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .limit(30),
    supabase
      .from('business_ai_knowledge')
      .select('content, fields')
      .eq('business_id', integration.business_id)
      .maybeSingle(),
  ]);

  const systemPrompt = buildConciergeSystemPrompt({
    businessName: business?.business_name ?? 'bisnis kami',
    businessSector: business?.business_sector ?? null,
    channel: lead.channel,
    aiPersona: integration.ai_persona ?? null,
    catalogItems: (catalog ?? []) as ConciergeCatalogItem[],
    businessKnowledge: formatBusinessKnowledge(knowledge?.fields ?? null, knowledge?.content ?? null),
  });

  const result = await generateProText(systemPrompt, history);
  if (!result) {
    console.warn('[ai/concierge] semua jalur (Vertex + gratis) gagal — skip balasan');
    return null;
  }

  const parsed = parseReply(result.text);
  if (!parsed) return null;

  return { reply: parsed.reply, images: parsed.images, provider: result.provider, model: result.model };
}
