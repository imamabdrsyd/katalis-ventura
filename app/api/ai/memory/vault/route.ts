import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getAuthenticatedUser } from '@/lib/supabase-server';

import { getMemoryVault } from '@/lib/ai/memory';

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

    const memories = await getMemoryVault(businessId, user.id);
    return NextResponse.json({ memories });
  } catch (err) {
    console.error('[API] /api/ai/memory/vault GET error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
