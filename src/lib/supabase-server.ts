import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import type { UserRole } from '@/types';

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
 * Uses @supabase/ssr to read session cookies and verify the user server-side.
 * Returns the user object or null if not authenticated.
 */
export async function getAuthenticatedUser() {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}

export async function getBusinessRoleForUser(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  businessId: string
): Promise<UserRole | null> {
  const [{ data: role }, { data: business }] = await Promise.all([
    supabase
      .from('user_business_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .maybeSingle(),
    supabase
      .from('businesses')
      .select('created_by')
      .eq('id', businessId)
      .maybeSingle(),
  ]);

  const normalized = normalizeRole(role?.role);
  if (normalized) return normalized;
  if (business?.created_by === userId) return 'business_manager';
  return null;
}

export async function canManageBusiness(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  businessId: string
): Promise<boolean> {
  return isManagerRole(await getBusinessRoleForUser(supabase, userId, businessId));
}
