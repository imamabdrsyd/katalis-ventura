import { NextResponse } from 'next/server';
import { createAdminClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { serverError, unauthorized } from '@/lib/api/server/responses';
import type { DiscoverableBusiness } from '@/types';

/**
 * GET /api/businesses/discoverable
 *
 * Daftar bisnis yang bisa diminta untuk digabungi dari /join-business.
 *
 * Dilayani admin client, BUKAN session user, dan hanya mengembalikan empat
 * kolom yang benar-benar dirender kartu pilihan. Sebelumnya halaman itu
 * memanggil `select('*')` langsung dari browser dan bersandar pada policy RLS
 * "Authenticated users can view all businesses" (USING true) — sehingga setiap
 * user yang login ikut menarik `ical_feed_token`, `qris_image_url`,
 * `property_address`, `registered_address`, dan `invoice_settings` milik SEMUA
 * bisnis. Menyempitkan select() di sisi klien tidak menutup apa pun karena
 * PostgREST menerima `select=*` dari siapa saja; jadi penyaringannya harus di
 * server, dan policy selimut itu dicabut di migrasi 149.
 *
 * `capital_investment` sengaja tetap ada — kartu pilihan memang menampilkan
 * "Modal: Rp …" sebagai informasi untuk calon investor.
 */
export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const admin = createAdminClient();

    // Bisnis yang sudah diikuti tidak perlu muncul sebagai pilihan.
    const { data: myRoles, error: rolesErr } = await admin
      .from('user_business_roles')
      .select('business_id')
      .eq('user_id', user.id);

    if (rolesErr) return serverError(rolesErr);

    const joined = new Set((myRoles ?? []).map((r) => r.business_id as string));

    const { data, error } = await admin
      .from('businesses')
      .select('id, business_name, logo_url, capital_investment')
      .eq('is_archived', false)
      .order('business_name', { ascending: true });

    if (error) return serverError(error);

    const result = ((data ?? []) as DiscoverableBusiness[]).filter((b) => !joined.has(b.id));

    return NextResponse.json({ data: result });
  } catch (err) {
    return serverError(err);
  }
}
