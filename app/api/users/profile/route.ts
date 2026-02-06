import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createAdminClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    // Verify the caller is authenticated
    const caller = await getAuthenticatedUser();
    if (!caller) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Validate UUID format to prevent injection
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID format' },
        { status: 400 }
      );
    }

    // Use admin client only after auth is verified
    const supabaseAdmin = createAdminClient();

    // Fetch user profile using service role (bypass RLS)
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('full_name, id')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      // Fallback: try to get from auth.users
      const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (authData?.user) {
        return NextResponse.json({
          full_name:
            authData.user.user_metadata?.full_name ||
            authData.user.email?.split('@')[0] ||
            'Unknown',
        });
      }
      throw error;
    }

    return NextResponse.json({
      full_name: data?.full_name || 'Unknown',
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile', full_name: 'Unknown' },
      { status: 500 }
    );
  }
}
