import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/api/server/platformAdmin';
import { createServerClient } from '@/lib/supabase-server';
import { badRequest, notFound, serverError, validationError } from '@/lib/api/server/responses';
import { mergeSiteContent, isSameContent } from '@/lib/site/merge';
import { SITE_PAGE_SCHEMAS } from '@/lib/site/validation';
import { getPageDefaults } from '@/lib/site/server';
import { SITE_PAGE_KEYS, type SitePageKey } from '@/lib/site/types';

interface RouteParams {
  params: Promise<{ pageKey: string }>;
}

function parsePageKey(raw: string): SitePageKey | null {
  return (SITE_PAGE_KEYS as readonly string[]).includes(raw) ? (raw as SitePageKey) : null;
}

/**
 * GET /api/admin/site/[pageKey]
 *
 * Mengembalikan draft yang sudah di-merge di atas default kode. Editor selalu
 * menerima dokumen UTUH — itu yang membuat form tidak pernah menampilkan field
 * kosong untuk key yang baru ditambahkan ke skema, dan yang membuat PUT bisa
 * divalidasi ketat.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate.response;

  const { pageKey: rawKey } = await params;
  const pageKey = parsePageKey(rawKey);
  if (!pageKey) return badRequest(`Halaman "${rawKey}" tidak dikenal.`);

  const defaults = getPageDefaults(pageKey);

  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('site_pages')
      .select('draft_content, published_content, published_at, updated_at')
      .eq('page_key', pageKey)
      .maybeSingle();

    if (error) return serverError(error);
    if (!data) return notFound(`Baris halaman "${pageKey}" belum ada.`);

    const draft = mergeSiteContent(defaults, data.draft_content);
    const published =
      data.published_content === null ? null : mergeSiteContent(defaults, data.published_content);

    return NextResponse.json({
      pageKey,
      draft,
      published,
      defaults,
      publishedAt: data.published_at,
      updatedAt: data.updated_at,
      /**
       * Belum pernah publish dihitung sebagai "ada perubahan" — supaya tombol
       * Publikasikan tidak terlihat mati padahal halaman publik masih memakai
       * default kode.
       */
      hasUnpublishedChanges:
        data.published_content === null || !isSameContent(draft, published),
    });
  } catch (error) {
    return serverError(error);
  }
}

/**
 * PUT /api/admin/site/[pageKey]
 *
 * Menyimpan draft. TIDAK menyentuh `published_content`, jadi halaman publik
 * tidak berubah sampai Publikasikan ditekan.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate.response;

  const { pageKey: rawKey } = await params;
  const pageKey = parsePageKey(rawKey);
  if (!pageKey) return badRequest(`Halaman "${rawKey}" tidak dikenal.`);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Body bukan JSON yang valid.');
  }

  const parsed = SITE_PAGE_SCHEMAS[pageKey].safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    // Sengaja lewat client bersesi, bukan service role: RLS
    // `site_pages_platform_admin_all` jadi lapisan kedua di belakang
    // requirePlatformAdmin, bukan dilewati.
    const supabase = await createServerClient();
    const { error } = await supabase
      .from('site_pages')
      .update({
        draft_content: parsed.data,
        updated_by: gate.admin.userId,
      })
      .eq('page_key', pageKey);

    if (error) return serverError(error);

    return NextResponse.json({ saved: true, draft: parsed.data });
  } catch (error) {
    return serverError(error);
  }
}
