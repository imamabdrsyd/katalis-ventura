/**
 * Tier Concierge AI per channel integration.
 *
 * Flag disimpan di kolom `config` JSONB yang SUDAH ada di channel_integrations
 * (database/migrations/101_leads_hub.sql) — tidak perlu migrasi.
 *
 * - 'free' (default): jalur murah existing — leadAssistant.generateLeadReply()
 *   via chain gratis (Gemini key → Groq). Tetap hidup saat kredit Vertex habis.
 * - 'pro': Concierge-Pro — persona CS terstruktur adaptif-sektor via Vertex
 *   (Claude/Gemini) dengan fallback otomatis ke chain gratis.
 *
 * Default-to-free penting: semua integrasi yang ada sekarang belum punya key
 * `ai_tier`, jadi mereka otomatis tetap di jalur gratis (nol regresi).
 */

import type { ChannelIntegration } from '@/types';

export type AiTier = 'free' | 'pro';

export function getAiTier(integration: ChannelIntegration): AiTier {
  const tier = (integration.config as Record<string, unknown> | null)?.ai_tier;
  return tier === 'pro' ? 'pro' : 'free';
}
