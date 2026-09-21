'use client';

/**
 * Daftar & editor artikel CMS.
 *
 * Artikel TIDAK memakai alur draft→publish dua tingkat seperti halaman, tapi
 * kolom `status` ('draft' | 'published'). Bedanya penting: halaman selalu ada di
 * situs dan yang berubah hanya isinya, sedangkan artikel bisa memang belum layak
 * tayang. Satu status lebih jujur menggambarkan itu daripada draft terpisah.
 *
 * Artikel yang masih hidup di kode tidak muncul di sini — ia tidak ada di DB.
 * Panel menyebutkannya secara eksplisit supaya tidak terkesan hilang.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, ExternalLink, FileText, Plus, Trash2 } from 'lucide-react';
import { useConfirm } from '@/context/ConfirmContext';
import { BlockEditor, MarkupHint } from './BlockEditor';
import { SectionCard, TextField } from './SiteEditorFields';
import type { ContentBlock, Locale, PostCollection, SitePost } from '@/lib/site/types';

interface DraftPost {
  id: string | null;
  collection: PostCollection;
  slug: string;
  status: 'draft' | 'published';
  coverImageUrl: string;
  category: string;
  author: string;
  readingMinutes: number;
  keywords: string[];
  locales: Record<Locale, { title: string; excerpt: string; body: ContentBlock[] }>;
}

const EMPTY_LOCALE = { title: '', excerpt: '', body: [] as ContentBlock[] };

function toDraft(post: SitePost): DraftPost {
  return {
    id: post.id,
    collection: post.collection,
    slug: post.slug,
    status: post.status,
    coverImageUrl: post.coverImageUrl ?? '',
    category: post.content.category ?? '',
    author: post.content.author ?? '',
    readingMinutes: post.content.readingMinutes ?? 0,
    keywords: post.content.keywords ?? [],
    locales: {
      id: post.content.locales?.id ?? { ...EMPTY_LOCALE },
      en: post.content.locales?.en ?? { ...EMPTY_LOCALE },
    },
  };
}

function newDraft(collection: PostCollection): DraftPost {
  return {
    id: null,
    collection,
    slug: '',
    status: 'draft',
    coverImageUrl: '',
    category: '',
    author: 'Tim AXION',
    readingMinutes: 0,
    keywords: [],
    locales: { id: { ...EMPTY_LOCALE }, en: { ...EMPTY_LOCALE } },
  };
}

/** Bentuk payload yang diterima API — bahasa tanpa judul tidak dikirim. */
function toPayload(draft: DraftPost) {
  const locales: Partial<DraftPost['locales']> = {};
  for (const locale of ['id', 'en'] as const) {
    if (draft.locales[locale].title.trim()) locales[locale] = draft.locales[locale];
  }

  return {
    collection: draft.collection,
    slug: draft.slug,
    status: draft.status,
    coverImageUrl: draft.coverImageUrl || null,
    content: {
      category: draft.category,
      author: draft.author,
      readingMinutes: draft.readingMinutes,
      keywords: draft.keywords,
      locales,
    },
  };
}

export function PostsManager({ collection }: { collection: PostCollection }) {
  const confirm = useConfirm();
  const [posts, setPosts] = useState<SitePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<DraftPost | null>(null);
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({ meta: true, id: true });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/posts?collection=${collection}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Gagal memuat artikel.');
      setPosts(body.posts);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat artikel.');
    } finally {
      setLoading(false);
    }
  }, [collection]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(
        editing.id ? `/api/admin/posts/${editing.id}` : '/api/admin/posts',
        {
          method: editing.id ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toPayload(editing)),
        }
      );
      const body = await res.json();

      if (!res.ok) {
        const detail =
          Array.isArray(body.details) && body.details.length > 0
            ? `${body.details[0].field}: ${body.details[0].message}`
            : body.error;
        throw new Error(detail ?? 'Gagal menyimpan artikel.');
      }

      toast.success(
        editing.status === 'published' ? 'Artikel tersimpan & tayang' : 'Artikel tersimpan sebagai draft'
      );
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan artikel.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (post: SitePost) => {
    const title = post.content.locales?.id?.title ?? post.slug;
    const ok = await confirm({
      title: 'Hapus artikel?',
      // Dijelaskan bahwa ini permanen, dan disebutkan alternatifnya — draft —
      // supaya menurunkan artikel tidak berujung penghapusan yang disesali.
      message: `"${title}" akan dihapus permanen dan tidak bisa dipulihkan. Kalau hanya ingin menurunkannya dari situs, ubah statusnya jadi draft.`,
      confirmLabel: 'Hapus permanen',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/admin/posts/${post.id}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Gagal menghapus artikel.');
      toast.success('Artikel dihapus');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus artikel.');
    }
  };

  const toggleCard = (key: string) => setOpenCards((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── Mode editor ────────────────────────────────────────────────────────────
  if (editing) {
    const update = (patch: Partial<DraftPost>) =>
      setEditing((prev) => (prev ? { ...prev, ...patch } : prev));

    const updateLocale = (
      locale: Locale,
      patch: Partial<DraftPost['locales']['id']>
    ) =>
      setEditing((prev) =>
        prev
          ? { ...prev, locales: { ...prev.locales, [locale]: { ...prev.locales[locale], ...patch } } }
          : prev
      );

    return (
      <div className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 cursor-pointer"
              aria-label="Kembali ke daftar"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                {editing.id ? 'Sunting artikel' : 'Artikel baru'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {editing.slug ? `/blog/${editing.slug}` : 'Slug belum diisi'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              className="input !w-auto !py-2"
              value={editing.status}
              onChange={(event) =>
                update({ status: event.target.value as DraftPost['status'] })
              }
            >
              <option value="draft">Draft</option>
              <option value="published">Tayang</option>
            </select>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </header>

        <SectionCard
          title="Metadata artikel"
          open={Boolean(openCards.meta)}
          onToggleOpen={() => toggleCard('meta')}
        >
          <TextField
            label="Slug"
            hint="Bagian URL setelah /blog/ — huruf kecil, angka, tanda hubung"
            value={editing.slug}
            onChange={(slug) => update({ slug })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Kategori"
              value={editing.category}
              onChange={(category) => update({ category })}
            />
            <TextField
              label="Penulis"
              value={editing.author}
              onChange={(author) => update({ author })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Lama baca (menit)"
              type="number"
              value={String(editing.readingMinutes)}
              onChange={(value) => update({ readingMinutes: Number(value) || 0 })}
            />
            <TextField
              label="Gambar sampul"
              hint="Path /images/… atau URL https (opsional)"
              value={editing.coverImageUrl}
              onChange={(coverImageUrl) => update({ coverImageUrl })}
            />
          </div>
          <TextField
            label="Kata kunci"
            hint="Pisahkan dengan koma"
            multiline
            rows={2}
            value={editing.keywords.join(', ')}
            onChange={(raw) =>
              update({
                keywords: raw
                  .split(',')
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
          />
        </SectionCard>

        <div className="card-static">
          <MarkupHint />
        </div>

        {(['id', 'en'] as const).map((locale) => (
          <SectionCard
            key={locale}
            title={locale === 'id' ? 'Versi Bahasa Indonesia' : 'Versi English'}
            description={
              editing.locales[locale].title
                ? `${editing.locales[locale].body.length} blok`
                : 'Kosongkan judul bila tidak ingin versi bahasa ini tayang'
            }
            open={Boolean(openCards[locale])}
            onToggleOpen={() => toggleCard(locale)}
          >
            <TextField
              label="Judul"
              value={editing.locales[locale].title}
              onChange={(title) => updateLocale(locale, { title })}
            />
            <TextField
              label="Ringkasan"
              hint="Tampil di kartu daftar artikel & deskripsi pencarian"
              multiline
              rows={3}
              value={editing.locales[locale].excerpt}
              onChange={(excerpt) => updateLocale(locale, { excerpt })}
            />
            <div>
              <span className="label">Isi artikel</span>
              <BlockEditor
                blocks={editing.locales[locale].body}
                onChange={(body) => updateLocale(locale, { body })}
              />
            </div>
          </SectionCard>
        ))}
      </div>
    );
  }

  // ── Mode daftar ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Artikel</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Artikel yang dikelola dari panel ini. Artikel lama yang tertanam di kode tidak
            muncul di daftar, tapi tetap tayang di /blog.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(newDraft(collection))}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Artikel baru
        </button>
      </header>

      {loading ? (
        <div className="space-y-3">
          <div className="h-20 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />
          <div className="h-20 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />
        </div>
      ) : posts.length === 0 ? (
        <div className="card-static text-center">
          <FileText className="mx-auto mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Belum ada artikel yang dibuat dari panel ini.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const title =
              post.content.locales?.id?.title ?? post.content.locales?.en?.title ?? post.slug;
            return (
              <div key={post.id} className="card-static flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span
                      className={`badge ${
                        post.status === 'published'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {post.status === 'published' ? 'Tayang' : 'Draft'}
                    </span>
                    {post.content.category && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {post.content.category}
                      </span>
                    )}
                  </div>
                  <p className="truncate font-semibold text-gray-800 dark:text-gray-100">
                    {title}
                  </p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                    /blog/{post.slug}
                  </p>
                </div>

                {post.status === 'published' && (
                  <a
                    href={`/blog/${post.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                    aria-label="Buka artikel"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(toDraft(post))}
                  className="btn-ghost shrink-0"
                >
                  Sunting
                </button>
                <button
                  type="button"
                  onClick={() => remove(post)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 cursor-pointer"
                  aria-label="Hapus artikel"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
