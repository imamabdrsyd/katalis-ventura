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
      .select('id, business_name')
      .eq('created_by', user.id);

    if (businessesError) throw businessesError;

    if (!businesses || businesses.length === 0) {
      return NextResponse.json({ requests: [] });
    }

    const businessIds = businesses.map((b) => b.id);
    const businessMap = new Map(businesses.map((b) => [b.id, b]));

    const { data: rawRequests, error: requestsError } = await supabase
      .from('business_join_requests')
      .select('id, business_id, requester_id, status, message, created_at')
      .in('business_id', businessIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (requestsError) throw requestsError;
    if (!rawRequests || rawRequests.length === 0) {
      return NextResponse.json({ requests: [] });
    }

    const requesterIds = Array.from(new Set(rawRequests.map((r) => r.requester_id)));
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', requesterIds);

    if (profilesError) throw profilesError;

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const requests = rawRequests.map((r) => ({
      id: r.id,
      business_id: r.business_id,
      requester_id: r.requester_id,
      status: r.status,
      message: r.message,
      created_at: r.created_at,
      requester: profileMap.get(r.requester_id) || { id: r.requester_id, full_name: 'Pengguna', avatar_url: null },
      business: businessMap.get(r.business_id) || { id: r.business_id, business_name: 'Bisnis' },
    }));

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch requests';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
