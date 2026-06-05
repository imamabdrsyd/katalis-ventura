import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import { PROVIDER_LABELS, MODEL_LABELS } from '@/lib/ai/provider';

/**
 * GET /api/ai/status — cek provider AI mana yang akan dipakai (standby).
 *
 * Ringan: hanya cek ketersediaan API key (urutan = prioritas chain), TIDAK
 * memanggil model. Dipakai AIChatPanel untuk menampilkan badge model dari awal
 * sebelum user kirim pesan pertama.
 *
 * Catatan: ini cuma "kemungkinan besar" — provider final ditentukan saat request
 * (Gemini bisa saja kena quota 429 lalu fallback Groq). Header X-AI-Model di
 * response chat tetap jadi sumber kebenaran provider yang BENAR-BENAR dipakai.
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
    model = 'gemini-2.5-flash-lite';
  } else if (process.env.GROQ_API_KEY) {
    provider = 'groq';
    model = 'llama-3.3-70b-versatile';
  }

  return NextResponse.json({
    available: provider !== null,
    provider: provider ? PROVIDER_LABELS[provider] : null,
    model: model ? (MODEL_LABELS[model] ?? model) : null,
  });
}
