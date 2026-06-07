import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, getAuthenticatedUser, getBusinessRoleForUser } from '@/lib/supabase-server';
import { isManagerRole } from '@/lib/roles';
import { COLUMN_MAPPING_PROMPT } from '@/lib/ai/prompts';
import { generateText } from '@/lib/ai/provider';

const bodySchema = z.object({
  business_id: z.string().uuid(),
  headers: z.array(z.string().max(200)).min(1).max(100),
  // Beberapa baris sampel (key = header asli) untuk bantu LLM menebak kolom amount/date.
  sample_rows: z.array(z.record(z.string(), z.any())).min(1).max(5),
});

type ColumnMapping = {
  date: string | null;
  description: string | null;
  amount: string | null;
  name: string | null;
  category: string | null;
};

const VALID_CATEGORIES = ['EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'];

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

  const { business_id, headers, sample_rows } = parsed.data;

  const supabase = await createServerClient();
  const role = await getBusinessRoleForUser(supabase, user.id, business_id);
  if (!role || !isManagerRole(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const payload = {
    headers,
    sample_rows,
  };

  const aiResult = await generateText(
    COLUMN_MAPPING_PROMPT,
    [{ role: 'user', content: JSON.stringify(payload) }],
    { temperature: 0 }
  );

  if (!aiResult) {
    return NextResponse.json({ mapping: null, source: 'none' });
  }

  try {
    const clean = aiResult.text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const obj = JSON.parse(clean) as Partial<ColumnMapping> & { default_category?: string };

    // Hanya terima header yang benar-benar ada di file (cegah halusinasi LLM).
    const valid = (h: unknown): string | null =>
      typeof h === 'string' && headers.includes(h) ? h : null;

    const mapping: ColumnMapping = {
      date: valid(obj.date),
      description: valid(obj.description),
      amount: valid(obj.amount),
      name: valid(obj.name),
      category: valid(obj.category),
    };

    // default_category bukan header — divalidasi terhadap enum kategori AXION.
    const defaultCategory =
      typeof obj.default_category === 'string' && VALID_CATEGORIES.includes(obj.default_category)
        ? obj.default_category
        : null;

    return NextResponse.json({ mapping, default_category: defaultCategory, source: aiResult.provider });
  } catch (err) {
    console.warn('[ai/map-columns] JSON parse error:', err);
    return NextResponse.json({ mapping: null, source: 'none' });
  }
}
