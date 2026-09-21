import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/api/server/platformAdmin';
import { createServerClient } from '@/lib/supabase-server';
import { badRequest, notFound, serverError } from '@/lib/api/server/responses';
import { SITE_PAGE_KEYS, type SitePageKey } from '@/lib/site/types';

interface RouteParams {
  params: Promise<{ pageKey: string }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parsePageKey(raw: string): SitePageKey | null {
  return (SITE_PAGE_KEYS as readonly string[]).includes(raw) ? (raw as SitePageKey) : null;
}

/**
 * GET /api/admin/site/[pageKey]/versions
 *
 * Daftar publikasi terakhir. Hanya metadata — isi penuh tiap versi tidak
 * dikirim karena dokumen landing page bisa puluhan KB dan daftar ini cuma
 * dipakai untuk memilih.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate.response;

  const { pageKey: rawKey } = await params;
  const pageKey = parsePageKey(rawKey);
  if (!pageKey) return badRequest(`Halaman "${rawKey}" tidak dikenal.`);

  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('site_page_versions')
      .select('id, label, created_at')
      .eq('page_key', pageKey)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) return serverError(error);

    return NextResponse.json({
      versions: (data ?? []).map((row) => ({
        id: row.id,
        label: row.label,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    return serverError(error);
  }
}

/**
 * POST /api/admin/site/[pageKey]/versions
 *
 * Memulihkan satu versi KE DALAM DRAFT — sengaja tidak langsung menayangkannya.
 * Admin jadi bisa melihat dulu hasilnya di pratinjau, lalu menekan Publikasikan
 * seperti perubahan biasa. Rollback satu klik yang langsung live justru mudah
 * disesali kalau versi yang dipilih ternyata salah.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate.response;

  const { pageKey: rawKey } = await params;
  const pageKey = parsePageKey(rawKey);
  if (!pageKey) return badRequest(`Halaman "${rawKey}" tidak dikenal.`);

  let versionId: string;
  try {
    const body = (await request.json()) as { versionId?: unknown };
    if (typeof body.versionId !== 'string' || !UUID_REGEX.test(body.versionId)) {
      return badRequest('versionId wajib berupa UUID.');
    }
    versionId = body.versionId;
  } catch {
    return badRequest('Body bukan JSON yang valid.');
  }

  try {
    const supabase = await createServerClient();

    const { data: version, error: readError } = await supabase
      .from('site_page_versions')
      .select('content')
      .eq('id', versionId)
      // Diikat ke page_key dari URL supaya versi halaman lain tidak bisa
      // disuntikkan ke halaman ini lewat id yang ditebak.
      .eq('page_key', pageKey)
      .maybeSingle();

    if (readError) return serverError(readError);
    if (!version) return notFound('Versi tidak ditemukan untuk halaman ini.');

    const { error: writeError } = await supabase
      .from('site_pages')
      .update({
        draft_content: version.content,
        updated_by: gate.admin.userId,
      })
      .eq('page_key', pageKey);

    if (writeError) return serverError(writeError);

    return NextResponse.json({
      restored: true,
      draft: version.content,
      message: 'Versi dimuat ke draft. Tekan Publikasikan untuk menayangkannya.',
    });
  } catch (error) {
    return serverError(error);
  }
}
