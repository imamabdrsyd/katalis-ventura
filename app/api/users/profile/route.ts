import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Fetch user profile using service role (bypass RLS)
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, id')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      // Fallback: try to get from auth.users
      const { data: authData } = await supabase.auth.admin.getUserById(userId);
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
