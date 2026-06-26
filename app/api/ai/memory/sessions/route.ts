export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getAuthenticatedUser } from '@/lib/supabase-server';

import { getSessions, deleteSession } from '@/lib/ai/memory';

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json({ error: 'Missing businessId' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data: roleData } = await supabase
      .from('user_business_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('business_id', businessId)
      .single();
    if (!roleData) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const sessions = await getSessions(businessId, user.id);
    return NextResponse.json({ sessions });
  } catch (err) {
    console.error('[API] /api/ai/memory/sessions GET error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId');
    const sessionId = searchParams.get('sessionId');

    if (!businessId || !sessionId) {
      return NextResponse.json({ error: 'Missing businessId or sessionId' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data: roleData } = await supabase
      .from('user_business_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('business_id', businessId)
      .single();
    if (!roleData) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const ok = await deleteSession(businessId, user.id, sessionId);
    if (!ok) return NextResponse.json({ error: 'Failed to delete session' }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API] /api/ai/memory/sessions DELETE error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
