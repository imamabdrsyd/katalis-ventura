import { NextResponse } from 'next/server';
import { createAdminClient, getAuthenticatedUser } from '@/lib/supabase-server';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    const supabase = createAdminClient();

    const { data: businesses, error: businessesError } = await supabase
      .from('businesses')
      .select('id')
      .eq('created_by', user.id);

    if (businessesError) throw businessesError;

    if (!businesses || businesses.length === 0) {
      return NextResponse.json({ requests: [] });
    }

    const businessIds = businesses.map((b) => b.id);

    const { data: requests, error: requestsError } = await supabase
      .from('business_join_requests')
      .select(`
        id,
        business_id,
        requester_id,
        status,
        message,
        created_at,
        requester:profiles(id, full_name, avatar_url),
        business:businesses(id, business_name)
      `)
      .in('business_id', businessIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (requestsError) throw requestsError;

    return NextResponse.json({ requests: requests || [] });
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}
