import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createServerClient } from '@/lib/supabase-server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/users/profile?userId=<uuid>
 *
 * Returns the target user's public display name.
 * Access is limited to:
 *   - The requesting user themselves, OR
 *   - A user who shares at least one business (via user_business_roles) with the target.
 *
 * Uses the session-scoped server client — RLS on `profiles` (read_public)
 * + explicit shared-business check prevents enumeration of unrelated users.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId || !UUID_REGEX.test(userId)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  const supabase = await createServerClient();

  if (userId !== user.id) {
    // Must share a business with the target user
    const { data: myBusinesses } = await supabase
      .from('user_business_roles')
      .select('business_id')
      .eq('user_id', user.id);

    const businessIds = (myBusinesses ?? []).map((r) => r.business_id);
    if (businessIds.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [sharedRoleRes, createdBusinessRes] = await Promise.all([
      supabase
        .from('user_business_roles')
        .select('user_id')
        .eq('user_id', userId)
        .in('business_id', businessIds)
        .limit(1),
      supabase
        .from('businesses')
        .select('id')
        .eq('created_by', userId)
        .in('id', businessIds)
        .limit(1),
    ]);

    const shared =
      (sharedRoleRes.data?.length ?? 0) > 0 ||
      (createdBusinessRes.data?.length ?? 0) > 0;

    if (!shared) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const { data } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle();

  return NextResponse.json({ full_name: data?.full_name || 'Unknown' });
}
