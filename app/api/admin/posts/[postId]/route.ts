import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requirePlatformAdmin } from '@/lib/api/server/platformAdmin';
import { createServerClient } from '@/lib/supabase-server';
import { badRequest, notFound, serverError, validationError } from '@/lib/api/server/responses';
import { sitePostUpsertSchema } from '@/lib/site/validation';
import { sitePostCacheTag, sitePostsCacheTag } from '@/lib/site/cache';
import { isCodePostSlug } from '@/lib/site/posts';
import type { PostCollection } from '@/lib/site/types';

interface RouteParams {
  params: Promise<{ postId: string }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PUT /api/admin/posts/[postId]
 *
 * Menyimpan artikel. Slug boleh berubah — karena itu cache artikel LAMA juga
 * dibatalkan, bukan hanya yang baru; kalau tidak, URL lama akan terus menyajikan
 * isi lama dari cache sampai TTL habis.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate.response;

  const { postId } = await params;
  if (!UUID_REGEX.test(postId)) return badRequest('postId harus UUID.');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Body bukan JSON yang valid.');
  }

  const parsed = sitePostUpsertSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const post = parsed.data;

  if (post.collection === 'blog' && isCodePostSlug(post.slug)) {
    return badRequest(
      `Slug "${post.slug}" sudah dipakai artikel yang tertanam di kode. Pilih slug lain.`
    );
  }

  try {
    const supabase = await createServerClient();

    const { data: existing, error: readError } = await supabase
      .from('site_posts')
      .select('slug, collection, published_at')
      .eq('id', postId)
      .maybeSingle();

    if (readError) return serverError(readError);
    if (!existing) return notFound('Artikel tidak ditemukan.');

    const { error } = await supabase
      .from('site_posts')
      .update({
        collection: post.collection,
        slug: post.slug,
        status: post.status,
        published_at:
          post.publishedAt ??
          existing.published_at ??
          (post.status === 'published' ? new Date().toISOString() : null),
        content: post.content,
        cover_image_url: post.coverImageUrl ?? null,
        sort_order: post.sortOrder ?? 0,
        updated_by: gate.admin.userId,
      })
      .eq('id', postId);

    if (error) {
      if (error.code === '23505') {
        return badRequest(`Slug "${post.slug}" sudah dipakai artikel lain di koleksi ini.`);
      }
      return serverError(error);
    }

    invalidate(existing.collection as PostCollection, existing.slug as string);
    invalidate(post.collection, post.slug);

    return NextResponse.json({ saved: true });
  } catch (error) {
    return serverError(error);
  }
}

/**
 * DELETE /api/admin/posts/[postId]
 *
 * Hapus permanen. Artikel CMS tidak punya soft delete seperti transaksi: ia
 * bukan catatan keuangan yang butuh jejak audit, dan draft sudah jadi jalan
 * untuk menurunkan artikel tanpa menghapusnya.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate.response;

  const { postId } = await params;
  if (!UUID_REGEX.test(postId)) return badRequest('postId harus UUID.');

  try {
    const supabase = await createServerClient();

    const { data: existing, error: readError } = await supabase
      .from('site_posts')
      .select('slug, collection')
      .eq('id', postId)
      .maybeSingle();

    if (readError) return serverError(readError);
    if (!existing) return notFound('Artikel tidak ditemukan.');

    const { error } = await supabase.from('site_posts').delete().eq('id', postId);
    if (error) return serverError(error);

    invalidate(existing.collection as PostCollection, existing.slug as string);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return serverError(error);
  }
}

function invalidate(collection: PostCollection, slug: string) {
  revalidateTag(sitePostsCacheTag(collection), 'max');
  revalidateTag(sitePostCacheTag(collection, slug), 'max');
}
