import { generateText } from './provider';
import { PARSE_SYSTEM_PROMPT } from './prompts';
import { parseTransactionMessage } from '@/lib/telegram/parser';

export interface ExtractedTransaction {
  name: string;
  amount: number;
  date: string | null;
  category_hint: string | null;
}

export interface ExtractResult {
  extracted: ExtractedTransaction;
  /** 'ai' = dari provider AI; 'rule_based' = fallback regex */
  source: 'ai' | 'rule_based';
  /** Provider AI yang dipakai (gemini/groq), null kalau rule-based */
  provider: string | null;
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
 * Return null kalau bahkan regex tidak bisa mendeteksi nama+nominal.
 */
export async function extractTransactionFromText(text: string): Promise<ExtractResult | null> {
  // 1. Coba AI provider chain
  const aiResult = await generateText(PARSE_SYSTEM_PROMPT, [{ role: 'user', content: text }], { temperature: 0 });
  if (aiResult) {
    try {
      const clean = aiResult.text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
      const g = JSON.parse(clean) as {
        name?: string; amount?: number; date?: string | null; category_hint?: string | null;
      };
      const name = (g.name ?? '').trim();
      const amount = Number(g.amount ?? 0);
      if (name && Number.isFinite(amount) && amount > 0) {
        return {
          extracted: { name, amount, date: g.date ?? null, category_hint: g.category_hint ?? null },
          source: 'ai',
          provider: aiResult.provider,
        };
      }
    } catch {
      console.warn('[ai/parseTransaction] AI JSON parse failed, fallback rule-based');
    }
  }

  // 2. Fallback regex
  const rb = parseTransactionMessage(text);
  if (rb) {
    return {
      extracted: { name: rb.name, amount: rb.amount, date: null, category_hint: rb.category },
      source: 'rule_based',
      provider: null,
    };
  }

  return null;
}
