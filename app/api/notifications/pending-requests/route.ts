import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Get all businesses owned by the user
    const { data: userBusinesses, error: businessesError } = await supabase
      .from('user_business_roles')
      .select('business_id')
      .eq('user_id', userId)
      .eq('role', 'owner');

    if (businessesError) throw businessesError;

    if (!userBusinesses || userBusinesses.length === 0) {
      return NextResponse.json({ requests: [] });
    }

    const businessIds = userBusinesses.map(b => b.business_id);

    // Get all pending join requests for these businesses
    const { data: requests, error: requestsError } = await supabase
      .from('business_join_requests')
      .select(`
        id,
        business_id,
        requester_id,
        status,
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
