import { NextRequest, NextResponse } from 'next/server';
import { canManageBusiness, getAuthenticatedUser, createServerClient } from '@/lib/supabase-server';
import { z } from 'zod';

const periodLockSchema = z.object({
  closed_until_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

interface RouteParams {
  params: Promise<{ businessId: string }>;
}

/**
 * PUT /api/businesses/[businessId]/period-lock
 * Set or clear period lock for a business (managers only)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { businessId } = await params;

    const body = await request.json();
    const parsed = periodLockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Format tanggal tidak valid. Gunakan YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Only business managers/superadmin members can set period lock
    if (!(await canManageBusiness(supabase, user.id, businessId))) {
      return NextResponse.json(
        { error: 'Hanya business manager yang dapat mengatur period lock' },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('businesses')
      .update({ closed_until_date: parsed.data.closed_until_date })
      .eq('id', businessId)
      .select('id, closed_until_date')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Period lock PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
