import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Create an authenticated Supabase client for API route handlers.
 * Uses the user's session cookie — respects RLS policies.
 */
export async function createServerClient() {
  const cookieStore = await cookies();

  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

/**
 * Create a Supabase admin client with service role.
 * Bypasses RLS — use only when necessary and ALWAYS validate auth first.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(url, key);
}

/**
 * Extract and verify the authenticated user from an API route request.
 * Reads the access token from cookies (set by @supabase/auth-helpers-nextjs)
 * and verifies it using the admin client.
 * Returns the user object or null if not authenticated.
 */
export async function getAuthenticatedUser() {
  const cookieStore = await cookies();

  // @supabase/auth-helpers-nextjs stores the session as JSON in a cookie named
  // "sb-<project-ref>-auth-token" (may be chunked as "...-auth-token.0", "...-auth-token.1", etc.)
  const allCookies = cookieStore.getAll();

  // Find the auth token cookie (supports chunked cookies like key.0, key.1, ...)
  const authCookies = allCookies
    .filter((c) => c.name.includes('-auth-token'))
    .sort((a, b) => {
      const numA = parseInt(a.name.split('.').pop() ?? '0', 10) || 0;
      const numB = parseInt(b.name.split('.').pop() ?? '0', 10) || 0;
      return numA - numB;
    });

  if (authCookies.length === 0) return null;

  // Reassemble chunked value if needed
  const rawValue = authCookies.map((c) => c.value).join('');

  let accessToken: string | null = null;
  try {
    // Value is a JSON array: [access_token, refresh_token, ...]
    // or a base64url encoded JSON string
    let parsed = rawValue;
    // Some versions store as base64url
    if (!parsed.startsWith('[') && !parsed.startsWith('{')) {
      parsed = Buffer.from(rawValue, 'base64').toString('utf-8');
    }
    const arr = JSON.parse(parsed);
    accessToken = Array.isArray(arr) ? arr[0] : arr.access_token ?? null;
  } catch {
    return null;
  }

  if (!accessToken) return null;

  // Verify the token using the admin client (getUser validates JWT server-side)
  const admin = createAdminClient();
  const { data: { user }, error } = await admin.auth.getUser(accessToken);

  if (error || !user) return null;
  return user;
}
