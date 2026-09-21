import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requirePlatformAdmin } from '@/lib/api/server/platformAdmin';
import { createServerClient } from '@/lib/supabase-server';
import { badRequest, notFound, serverError, validationError } from '@/lib/api/server/responses';
import { mergeSiteContent } from '@/lib/site/merge';
import { SITE_PAGE_SCHEMAS } from '@/lib/site/validation';
import { getPageDefaults } from '@/lib/site/server';
import { sitePageCacheTag } from '@/lib/site/cache';
import { SITE_PAGE_KEYS, type SitePageKey } from '@/lib/site/types';

interface RouteParams {
  params: Promise<{ pageKey: string }>;
}

function parsePageKey(raw: string): SitePageKey | null {
  return (SITE_PAGE_KEYS as readonly string[]).includes(raw) ? (raw as SitePageKey) : null;
}

/**
 * POST /api/admin/site/[pageKey]/publish
 *
 * Menayangkan draft: `draft_content` → `published_content`, lalu membatalkan
 * cache halaman publik supaya perubahan langsung terlihat (bukan menunggu TTL).
 *
 * Draft divalidasi ULANG di sini, tidak hanya saat disimpan. Draft bisa berasal
 * dari dokumen lama yang disimpan sebelum skema berubah, dan publish adalah
 * satu-satunya titik yang menentukan apa yang dilihat publik — di situlah
 * gerbang paling ketat harus berada.
 *
 * Snapshot versi ditulis SEBELUM publish diakui berhasil, supaya setiap isi
 * yang pernah tayang selalu punya jejak untuk dipulihkan.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate.response;

  const { pageKey: rawKey } = await params;
  const pageKey = parsePageKey(rawKey);
  if (!pageKey) return badRequest(`Halaman "${rawKey}" tidak dikenal.`);

  const defaults = getPageDefaults(pageKey);
  if (defaults === null) {
    return badRequest(`Halaman "${pageKey}" belum dikelola lewat CMS.`);
  }

  let label: string | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body === 'object' && 'label' in body) {
      const raw = (body as { label?: unknown }).label;
      if (typeof raw === 'string' && raw.trim()) label = raw.trim().slice(0, 120);
    }
  } catch {
    // Body opsional — label kosong bukan kesalahan.
  }

  try {
    const supabase = await createServerClient();

    const { data: row, error: readError } = await supabase
      .from('site_pages')
      .select('draft_content')
      .eq('page_key', pageKey)
      .maybeSingle();

    if (readError) return serverError(readError);
    if (!row) return notFound(`Baris halaman "${pageKey}" belum ada.`);

    const merged = mergeSiteContent(defaults, row.draft_content);
    const parsed = SITE_PAGE_SCHEMAS[pageKey].safeParse(merged);
    if (!parsed.success) return validationError(parsed.error);

    const { error: versionError } = await supabase.from('site_page_versions').insert({
      page_key: pageKey,
      content: parsed.data,
      label,
      created_by: gate.admin.userId,
    });
    if (versionError) return serverError(versionError);

    const publishedAt = new Date().toISOString();
    const { error: publishError } = await supabase
      .from('site_pages')
      .update({
        published_content: parsed.data,
        published_at: publishedAt,
        published_by: gate.admin.userId,
        // Draft dinormalkan ke hasil merge yang tervalidasi, supaya draft dan
        // yang tayang benar-benar identik setelah publish — kalau tidak, badge
        // "ada perubahan belum dipublikasikan" akan menyala terus.
        draft_content: parsed.data,
        updated_by: gate.admin.userId,
      })
      .eq('page_key', pageKey);

    if (publishError) return serverError(publishError);

    revalidateTag(sitePageCacheTag(pageKey), 'max');

    return NextResponse.json({ published: true, publishedAt });
  } catch (error) {
    return serverError(error);
  }
}
