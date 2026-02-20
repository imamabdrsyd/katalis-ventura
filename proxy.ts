import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

const PROTECTED_PATHS = [
  '/dashboard',
  '/businesses',
  '/accounts',
  '/transactions',
  '/general-ledger',
  '/trial-balance',
  '/income-statement',
  '/balance-sheet',
  '/cash-flow',
  '/scenario-modeling',
  '/reports',
  '/roi-forecast',
  '/settings',
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always refresh the session so cookies stay valid for all routes including API routes.
  // createMiddlewareClient reads/writes session cookies so @supabase/ssr can read them.
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();

  // Auth guard — redirect to login for protected dashboard routes
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/).*)'],
};
