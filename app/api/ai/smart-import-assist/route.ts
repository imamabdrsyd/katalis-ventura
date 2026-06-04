import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, getAuthenticatedUser, getBusinessRoleForUser } from '@/lib/supabase-server';
import { isManagerRole } from '@/lib/roles';

const bodySchema = z.object({
  business_id: z.string().uuid(),
  // Baris yang perlu bantuan AI (low-confidence dari rule-based resolver).
  // Cap 50 baris per request untuk hemat token & latensi.
  rows: z.array(
    z.object({
      index: z.number().int(),
      description: z.string().max(300),
      category_hint: z.string().max(100).optional(),
    })
  ).min(1).max(50),
});

type Suggestion = { index: number; category: 'EARN' | 'OPEX' | 'VAR' | 'CAPEX' | 'TAX' | 'FIN' };

const VALID = ['EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'];

const ASSIST_PROMPT = `Kamu klasifikator kategori transaksi untuk akuntansi UKM Indonesia.
Untuk tiap baris (punya "index" dan "description"), tentukan kategori paling tepat.
Return JSON array SAJA: [{"index":number,"category":"EARN/OPEX/VAR/CAPEX/TAX/FIN"}]

Definisi kategori:
- EARN: pendapatan/penjualan/uang masuk dari operasi
- OPEX: beban operasional (listrik, gaji, sewa, internet, transport, konsumsi)
- VAR: HPP / bahan baku / persediaan / biaya variabel produksi
- CAPEX: beli aset tetap (mesin, peralatan, kendaraan, properti)
- TAX: pajak (PPN, PPh, pajak daerah)
- FIN: pinjaman, modal, cicilan, bunga, prive/penarikan pemilik

Wajib return SEMUA index yang diberikan. Tanpa teks lain, tanpa markdown.`;

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
  }

  const { business_id, rows } = parsed.data;

  const supabase = await createServerClient();
  const role = await getBusinessRoleForUser(supabase, user.id, business_id);
  if (!role || !isManagerRole(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  // AI = enhancement: kalau tidak tersedia, kembalikan kosong (caller tetap pakai
  // hasil rule-based). Bukan error — supaya import tetap jalan tanpa AI.
  if (!apiKey) {
    return NextResponse.json({ suggestions: [] as Suggestion[], source: 'none' });
  }

  const payload = rows.map((r) => ({
    index: r.index,
    description: r.category_hint ? `${r.description} [hint: ${r.category_hint}]` : r.description,
  }));

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: ASSIST_PROMPT }] },
          contents: [{ parts: [{ text: JSON.stringify(payload) }] }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' },
        }),
      }
    );
    if (!res.ok) {
      console.warn('[ai/smart-import-assist] Gemini unavailable:', res.status);
      return NextResponse.json({ suggestions: [] as Suggestion[], source: 'none' });
    }
    const json = await res.json();
    const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const clean = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const arr = JSON.parse(clean) as Array<{ index?: number; category?: string }>;

    const suggestions: Suggestion[] = arr
      .filter((s) => typeof s.index === 'number' && typeof s.category === 'string' && VALID.includes(s.category))
      .map((s) => ({ index: s.index!, category: s.category as Suggestion['category'] }));

    return NextResponse.json({ suggestions, source: 'gemini' });
  } catch (err) {
    console.warn('[ai/smart-import-assist] error, fallback empty:', err);
    return NextResponse.json({ suggestions: [] as Suggestion[], source: 'none' });
  }
}
