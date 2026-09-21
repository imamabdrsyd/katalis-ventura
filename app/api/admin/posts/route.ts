import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requirePlatformAdmin } from '@/lib/api/server/platformAdmin';
import { createServerClient } from '@/lib/supabase-server';
import { badRequest, serverError, validationError } from '@/lib/api/server/responses';
import { sitePostUpsertSchema } from '@/lib/site/validation';
import { sitePostCacheTag, sitePostsCacheTag } from '@/lib/site/cache';
import { getAllPosts, isCodePostSlug } from '@/lib/site/posts';
import type { PostCollection } from '@/lib/site/types';

const COLLECTIONS: readonly string[] = ['blog', 'market_insights'];

function parseCollection(raw: string | null): PostCollection | null {
  return raw && COLLECTIONS.includes(raw) ? (raw as PostCollection) : null;
}

/**
 * GET /api/admin/posts?collection=blog
 *
 * Daftar SEMUA artikel koleksi itu, termasuk draft — ini jalur admin.
 */
export async function GET(request: NextRequest) {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate.response;

  const collection = parseCollection(request.nextUrl.searchParams.get('collection'));
  if (!collection) return badRequest('Parameter collection harus blog atau market_insights.');

  try {
    return NextResponse.json({ posts: await getAllPosts(collection) });
  } catch (error) {
    return serverError(error);
  }
}

/**
 * POST /api/admin/posts
 *
 * Membuat artikel baru.
 */
export async function POST(request: NextRequest) {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Body bukan JSON yang valid.');
  }

  const parsed = sitePostUpsertSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const post = parsed.data;

  /**
   * Slug artikel yang masih hidup di kode tidak boleh diklaim.
   *
   * Route statis `app/blog/<slug>/page.tsx` menang atas `[slug]` di Next.js,
   * jadi artikel CMS dengan slug yang sama akan tersimpan rapi di DB tapi tidak
   * pernah bisa dibuka — gagal diam-diam, yang jauh lebih membingungkan daripada
   * ditolak sekarang.
   */
  if (post.collection === 'blog' && isCodePostSlug(post.slug)) {
    return badRequest(
      `Slug "${post.slug}" sudah dipakai artikel yang tertanam di kode. Pilih slug lain.`
    );
  }

  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('site_posts')
      .insert({
        collection: post.collection,
        slug: post.slug,
        status: post.status,
        // Artikel yang ditayangkan tanpa tanggal eksplisit dianggap terbit
        // sekarang — kalau dibiarkan null, ia akan terurut paling bawah di
        // indeks dan terlihat seperti artikel lama.
        published_at:
          post.publishedAt ?? (post.status === 'published' ? new Date().toISOString() : null),
        content: post.content,
        cover_image_url: post.coverImageUrl ?? null,
        sort_order: post.sortOrder ?? 0,
        created_by: gate.admin.userId,
        updated_by: gate.admin.userId,
      })
      .select('id')
      .single();

    if (error) {
      // 23505 = unique violation pada (collection, slug).
      if (error.code === '23505') {
        return badRequest(`Slug "${post.slug}" sudah dipakai artikel lain di koleksi ini.`);
      }
      return serverError(error);
    }

    revalidateTag(sitePostsCacheTag(post.collection), 'max');
    revalidateTag(sitePostCacheTag(post.collection, post.slug), 'max');

    return NextResponse.json({ created: true, id: data.id });
  } catch (error) {
    return serverError(error);
  }
}
