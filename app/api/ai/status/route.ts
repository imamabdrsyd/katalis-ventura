import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import { PROVIDER_LABELS, MODEL_LABELS, GEMINI_MODELS, isClaudeAvailable } from '@/lib/ai/provider';

/**
 * GET /api/ai/status — cek provider AI mana yang akan dipakai (standby).
 *
 * Ringan: hanya cek ketersediaan API key (urutan = prioritas chain), TIDAK
 * memanggil model. Dipakai AIChatPanel untuk menampilkan badge model dari awal
 * sebelum user kirim pesan pertama.
 *
 * Catatan: ini cuma "kemungkinan besar" — model final ditentukan saat request
 * (model utama bisa kena quota 429 lalu fallback ke model Gemini lain/Groq).
 * Header X-AI-Model di response chat tetap jadi sumber kebenaran model yang
 * BENAR-BENAR dipakai.
 */
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let provider: 'gemini' | 'groq' | null = null;
  let model: string | null = null;

  if (process.env.GEMINI_API_KEY) {
    provider = 'gemini';
    model = GEMINI_MODELS[0];
  } else if (process.env.GROQ_API_KEY) {
    provider = 'groq';
    // Chat analitik pakai Qwen QwQ; parser pakai Llama — badge standby reflect chat model
    model = 'qwen-qwq-32b';
  }

  return NextResponse.json({
    available: provider !== null,
    provider: provider ? PROVIDER_LABELS[provider] : null,
    model: model ? (MODEL_LABELS[model] ?? model) : null,
    // Apakah Claude (Vertex AI) tersedia sbg opsi manual di selector
    claudeAvailable: isClaudeAvailable(),
  });
}
