import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { canManageBusiness, createAdminClient, createServerClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { publicSlugCacheTag } from '@/lib/publicPageCache';

/**
 * POST /api/omni-channel/[businessId]/revalidate
 *
 * Membuang cache data halaman publik `/[slug]` atas permintaan dashboard.
 *
 * Kenapa perlu route yang kerjanya cuma ini: sebagian hal yang MENGUBAH isi
 * halaman publik ditulis dari browser lewat Supabase client (RLS), tanpa
 * melewati route handler mana pun — mutasi event (`src/lib/api/events.ts`)
 * contohnya. `revalidateTag` hanya ada di server, jadi perubahan seperti itu
 * tidak punya satu pun tempat untuk membatalkan cache-nya.
 *
 * Akibat nyatanya (dilaporkan 27 Nov 2026): owner menekan "Buka pendaftaran",
 * status di dashboard langsung berubah "Open", lalu membuka halaman bio-nya dan
 * TIDAK melihat kartu event sama sekali — halaman itu masih menyajikan snapshot
 * cache dari sebelum event dibuka. Kesimpulan yang wajar diambil siapa pun:
 * "fiturnya rusak". Padahal datanya benar dan cuma perlu lewat 60 detik.
 *
 * Dipanggil best-effort: gagal revalidate TIDAK boleh menggagalkan aksi yang
 * sudah berhasil tersimpan di DB (lihat `revalidatePublicPage` di sisi klien).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { businessId } = await params;

  const server = await createServerClient();
  if (!(await canManageBusiness(server, user.id, businessId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data: channel } = await supabase
    .from('business_omni_channels')
    .select('slug')
    .eq('business_id', businessId)
    .maybeSingle();

  // Bisnis tanpa halaman publik tidak punya cache untuk dibuang — bukan error.
  if (!channel?.slug) return NextResponse.json({ data: { revalidated: false } });

  // Next 16: argumen kedua wajib. 'max' = buang seluruh entri bertag ini.
  revalidateTag(publicSlugCacheTag(channel.slug), 'max');

  return NextResponse.json({ data: { revalidated: true, slug: channel.slug } });
}
