import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    await supabase.auth.exchangeCodeForSession(code);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: roles } = await supabase
        .from('user_business_roles')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (!roles || roles.length === 0) {
        return NextResponse.redirect(new URL('/select-role', request.url));
      }
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
