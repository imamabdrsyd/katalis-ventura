import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createServerClient,
  getAuthenticatedUser,
  getBusinessRoleForUser,
} from '@/lib/supabase-server';
import { withRouteTiming } from '@/lib/api/server/timing';

const querySchema = z.object({
  business_id: z.string().uuid(),
  account_id: z.string().uuid().optional(),
  match_status: z.enum(['unmatched', 'auto_matched', 'manual_matched', 'ignored', 'created_new']).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().positive().max(500).default(200),
});

/**
 * GET /api/bank-transactions?business_id=&account_id=&match_status=&from=&to=&limit=
 *
 * Return mutasi bank yang sudah di-import, di-filter sesuai query.
 * Default sort: posted_at DESC.
 */
export async function GET(req: NextRequest) {
  return withRouteTiming(req, '/api/bank-transactions', async () => {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse({
      business_id: searchParams.get('business_id'),
      account_id: searchParams.get('account_id') ?? undefined,
      match_status: searchParams.get('match_status') ?? undefined,
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query', details: parsed.error.flatten() }, { status: 400 });
    }

    const { business_id, account_id, match_status, from, to, limit } = parsed.data;

    const supabase = await createServerClient();
    const role = await getBusinessRoleForUser(supabase, user.id, business_id);
    if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let query = supabase
      .from('bank_transactions')
      .select('*')
      .eq('business_id', business_id)
      .order('posted_at', { ascending: false })
      .limit(limit);

    if (account_id) query = query.eq('account_id', account_id);
    if (match_status) query = query.eq('match_status', match_status);
    if (from) query = query.gte('posted_at', from);
    if (to) query = query.lte('posted_at', to);

    const { data, error } = await query;
    if (error) {
      console.error('[bank-transactions GET] error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  });
}
