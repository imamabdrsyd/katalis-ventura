import { generateText, generateTextGeminiVertex } from './provider';
import { PARSE_SYSTEM_PROMPT } from './prompts';
import { parseIncompleteTransactionMessage, parseTransactionMessage } from '@/lib/telegram/parser';

export interface ExtractedTransaction {
  name: string;
  amount: number;
  date: string | null;
  category_hint: string | null;
}

export interface ExtractResult {
  /** 'complete' = nama + nominal lengkap; 'needs_amount' = ada nama tapi nominal belum disebut */
  status: 'complete' | 'needs_amount';
  /** Untuk 'needs_amount', amount = 0 (placeholder) — minta user lengkapi */
  extracted: ExtractedTransaction;
  /** 'ai' = dari provider AI; 'rule_based' = fallback regex */
  source: 'ai' | 'rule_based';
  /** Provider AI yang dipakai (gemini/groq/claude), null kalau rule-based */
  provider: string | null;
  /** Model spesifik yang dipakai (mis. claude-haiku-4-5@20251001), null kalau rule-based */
  model: string | null;
}

export function resolveTransactionDate(
  extractedDate: string | null,
  carriedDate: string | null | undefined,
  fallbackDate: string
): string {
  const date = extractedDate ?? carriedDate;
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : fallbackDate;
}

/**
 * Ekstrak SATU transaksi dari teks natural language.
 *
 * Chain: AI provider (Gemini → Groq) → fallback parser regex (parseTransactionMessage).
 * AI = enhancement, bukan dependency — kalau semua provider gagal, regex tetap jalan.
 *
 * Dipakai bersama oleh:
 * - POST /api/ai/parse-transaction (chat panel web)
 * - Telegram bot handleTransactionMessage
 *
 * Return:
 * - status 'complete'      → nama + nominal valid, siap jadi draft.
 * - status 'needs_amount'  → user menyebut transaksi tapi LUPA nominal; caller
 *                            bisa balik tanya "berapa?" lalu gabung jawabannya.
 * - null                   → bahkan nama transaksi pun tak terdeteksi.
 */
export async function extractTransactionFromText(
  text: string,
  opts: { preferVertex?: boolean } = {}
): Promise<ExtractResult | null> {
  // 1. Coba AI provider. preferVertex → Gemini Vertex dulu (lebih cerdas, pakai
  //    billing GCP), fallback ke chain gratisan (Gemini AI Studio → Groq).
  const messages = [{ role: 'user' as const, content: text }];
  let aiResult = opts.preferVertex
    ? await generateTextGeminiVertex(PARSE_SYSTEM_PROMPT, messages, { temperature: 0 })
    : null;
  if (!aiResult) {
    aiResult = await generateText(PARSE_SYSTEM_PROMPT, messages, { temperature: 0 });
  }
  if (aiResult) {
    try {
      const clean = aiResult.text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
      const g = JSON.parse(clean) as {
        name?: string; amount?: number | null; date?: string | null; category_hint?: string | null;
      };
      const name = (g.name ?? '').trim();
      const amount = Number(g.amount ?? 0);
      const hasAmount = g.amount != null && Number.isFinite(amount) && amount > 0;
      if (name && hasAmount) {
        return {
          status: 'complete',
          extracted: { name, amount, date: g.date ?? null, category_hint: g.category_hint ?? null },
          source: 'ai',
          provider: aiResult.provider,
          model: aiResult.model,
        };
      }
      // Nama jelas tapi nominal belum disebut → minta user lengkapi
      if (name) {
        return {
          status: 'needs_amount',
          extracted: { name, amount: 0, date: g.date ?? null, category_hint: g.category_hint ?? null },
          source: 'ai',
          provider: aiResult.provider,
          model: aiResult.model,
        };
      }
    } catch {
      console.warn('[ai/parseTransaction] AI JSON parse failed, fallback rule-based');
    }
  }

  // 2. Fallback regex (rule-based hanya cocok kalau nominal terdeteksi)
  const rb = parseTransactionMessage(text);
  if (rb) {
    return {
      status: 'complete',
      extracted: { name: rb.name, amount: rb.amount, date: null, category_hint: rb.category },
      source: 'rule_based',
      provider: null,
      model: null,
    };
  }

  const partial = parseIncompleteTransactionMessage(text);
  if (partial) {
    return {
      status: 'needs_amount',
      extracted: { name: partial.name, amount: 0, date: null, category_hint: partial.category },
      source: 'rule_based',
      provider: null,
      model: null,
    };
  }

  return null;
}
