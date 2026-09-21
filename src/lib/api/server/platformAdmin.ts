import 'server-only';

/**
 * Gerbang otoritas tingkat PLATFORM untuk route handler.
 *
 * Bedanya dengan otoritas per-bisnis (`is_business_manager` / `isManagerRole`):
 * yang ini tidak terkait bisnis mana pun. Konten axionventura.com bukan milik
 * satu bisnis, jadi manager bisnis — sebanyak apa pun bisnis yang dia kelola —
 * tidak boleh menyentuhnya.
 *
 * Sumber otoritasnya `profiles.default_role = 'superadmin'`, yang aman dipakai
 * karena migrasi 089 memasang trigger `prevent_default_role_self_promotion`:
 * user terautentikasi tidak bisa menaikkan `default_role`-nya sendiri. Nilai ini
 * dibaca ulang dari DB setiap request — sengaja tidak dari JWT/klaim, supaya
 * pencabutan hak berlaku seketika, bukan setelah token kedaluwarsa.
 *
 * Catatan: RLS `site_pages` juga memakai `is_platform_admin()`, jadi ini lapisan
 * kedua, bukan satu-satunya. Route yang menulis lewat service role (mem-bypass
 * RLS) SEPENUHNYA bergantung pada pemeriksaan di sini — jangan dilewati.
 */

import { getAuthenticatedUser, createServerClient } from '@/lib/supabase-server';
import { isSuperadminRole } from '@/lib/roles';
import { forbidden, unauthorized } from './responses';
import type { NextResponse } from 'next/server';

export interface PlatformAdmin {
  userId: string;
}

type Guarded =
  | { ok: true; admin: PlatformAdmin }
  | { ok: false; response: NextResponse };

/**
 * Pakai di awal setiap route handler Site CMS:
 *
 *   const gate = await requirePlatformAdmin();
 *   if (!gate.ok) return gate.response;
 *   // gate.admin.userId aman dipakai sebagai updated_by
 */
export async function requirePlatformAdmin(): Promise<Guarded> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { ok: false, response: unauthorized() };
  }

  const supabase = await createServerClient();
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('default_role')
    .eq('id', user.id)
    .single();

  if (error || !isSuperadminRole(profile?.default_role)) {
    return {
      ok: false,
      response: forbidden('Hanya platform admin yang boleh mengelola konten situs.'),
    };
  }

  return { ok: true, admin: { userId: user.id } };
}

/**
 * Versi boolean untuk Server Component (mis. gate halaman /admin) yang perlu
 * memutuskan render vs redirect, bukan mengembalikan response HTTP.
 */
export async function isPlatformAdmin(): Promise<boolean> {
  const user = await getAuthenticatedUser();
  if (!user) return false;

  const supabase = await createServerClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('default_role')
    .eq('id', user.id)
    .single();

  return isSuperadminRole(profile?.default_role);
}
