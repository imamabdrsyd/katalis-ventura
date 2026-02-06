import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';

/**
 * GET /api/stats
 * Public endpoint — intentionally unauthenticated.
 * Returns aggregate platform statistics (user count, business count)
 * for use on the landing page. No PII is exposed.
 */
export async function GET() {
  try {
    const supabaseAdmin = createAdminClient();

    // Get total users count from profiles table
    const { count: usersCount, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (usersError) {
      console.error('Error fetching users count:', usersError);
    }

    // Get total businesses count
    const { count: businessesCount, error: businessesError } = await supabaseAdmin
      .from('businesses')
      .select('*', { count: 'exact', head: true })
      .eq('is_archived', false);

    if (businessesError) {
      console.error('Error fetching businesses count:', businessesError);
    }

    return NextResponse.json({
      users: usersCount || 0,
      businesses: businessesCount || 0,
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
