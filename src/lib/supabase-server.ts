import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Create an authenticated Supabase client for API route handlers.
 * Uses the user's session cookie — respects RLS policies.
 */
export function createServerClient() {
  return createRouteHandlerClient({ cookies });
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
 * Returns the user object or null if not authenticated.
 */
export async function getAuthenticatedUser() {
  const supabase = createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}
