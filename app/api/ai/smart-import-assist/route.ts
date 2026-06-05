import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, getAuthenticatedUser, getBusinessRoleForUser } from '@/lib/supabase-server';
import { isManagerRole } from '@/lib/roles';
import { IMPORT_ASSIST_PROMPT } from '@/lib/ai/prompts';
import { generateText } from '@/lib/ai/provider';

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

  const payload = rows.map((r) => ({
    index: r.index,
    description: r.category_hint ? `${r.description} [hint: ${r.category_hint}]` : r.description,
  }));

  // AI = enhancement: kalau semua provider gagal, return kosong (import tetap jalan rule-based)
  const aiResult = await generateText(
    IMPORT_ASSIST_PROMPT,
    [{ role: 'user', content: JSON.stringify(payload) }],
    { temperature: 0 }
  );
  if (!aiResult) {
    return NextResponse.json({ suggestions: [] as Suggestion[], source: 'none' });
  }

  try {
    const clean = aiResult.text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const arr = JSON.parse(clean) as Array<{ index?: number; category?: string }>;
    const suggestions: Suggestion[] = arr
      .filter((s) => typeof s.index === 'number' && typeof s.category === 'string' && VALID.includes(s.category))
      .map((s) => ({ index: s.index!, category: s.category as Suggestion['category'] }));

    return NextResponse.json({ suggestions, source: aiResult.provider });
  } catch (err) {
    console.warn('[ai/smart-import-assist] JSON parse error:', err);
    return NextResponse.json({ suggestions: [] as Suggestion[], source: 'none' });
  }
}
