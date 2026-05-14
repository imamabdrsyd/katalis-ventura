import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { canManageBusiness, getAuthenticatedUser, createAdminClient, createServerClient } from '@/lib/supabase-server';

const patchSchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  price: z.number().nonnegative().optional(),
  label: z.string().max(100).nullable().optional(),
});

async function verifyManager(userId: string, businessId: string) {
  const supabase = await createServerClient();
  return canManageBusiness(supabase, userId, businessId);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string; ruleId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { businessId, ruleId } = await params;
  if (!(await verifyManager(user.id, businessId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('business_pricing_rules')
    .update(parsed.data)
    .eq('id', ruleId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ businessId: string; ruleId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { businessId, ruleId } = await params;
  if (!(await verifyManager(user.id, businessId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('business_pricing_rules')
    .delete()
    .eq('id', ruleId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
