import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshing the auth token is critical — this call reads & writes cookies.
  // Do NOT remove this line. Any logic between createServerClient and
  // supabase.auth.getUser() that returns early could cause stale sessions.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/accounts/:path*',
    '/general-ledger/:path*',
    '/trial-balance/:path*',
    '/ar-ap/:path*',
    '/income-statement/:path*',
    '/balance-sheet/:path*',
    '/cash-flow/:path*',
    '/scenario-modeling/:path*',
    '/roi-forecast/:path*',
    '/reports/:path*',
    '/transactions/:path*',
    '/invoices/:path*',
    '/reconciliation/:path*',
    '/closing-entry/:path*',
    '/businesses/:path*',
    '/settings/:path*',
    '/market/:path*',
    '/setup-business/:path*',
    '/join-business/:path*',
    '/api/((?!stats|public-businesses|market/|telegram/webhook|whatsapp/webhook|webhooks/inbound).*)',
  ],
};
