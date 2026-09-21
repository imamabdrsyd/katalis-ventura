'use client';

/**
 * Editor kepala halaman /blog dan /market-insights.
 *
 * Hanya bagian yang ditulis manusia: eyebrow, judul, paragraf, metadata SEO.
 * Isi /market-insights sendiri (kurs, makro, berita) datang dari API eksternal
 * dan sengaja tidak ada di sini — itu data hidup, bukan konten.
 *
 * Satu bahasa, sesuai halaman yang tayang: keduanya tidak punya pengalih bahasa
 * sendiri (yang di footer landing page hanya memengaruhi landing page).
 */

import { useState } from 'react';
import { useSiteEditor } from '@/hooks/useSiteEditor';
import { SiteEditorShell } from './SiteEditorShell';
import { SectionCard, TextField } from './SiteEditorFields';
import type { CollectionIndexContent } from '@/lib/site/types';

const META = {
  blog_index: {
    title: 'Kepala halaman /blog',
    description: 'Judul & pengantar di atas daftar artikel.',
    liveHref: '/blog',
  },
  market_insights: {
    title: 'Kepala halaman /market-insights',
    description: 'Judul & pengantar di atas data pasar.',
    liveHref: '/market-insights',
  },
} as const;

export function CollectionIndexEditor({
  pageKey,
}: {
  pageKey: 'blog_index' | 'market_insights';
}) {
  const editor = useSiteEditor<CollectionIndexContent>(pageKey);
  const [open, setOpen] = useState({ isi: true, seo: false });

  const draft = editor.draft;
  const meta = META[pageKey];

  return (
    <SiteEditorShell
      title={meta.title}
      description={meta.description}
      liveHref={meta.liveHref}
      loading={editor.loading}
      saving={editor.saving}
      publishing={editor.publishing}
      error={editor.error}
      isDirty={editor.isDirty}
      hasUnpublishedChanges={editor.hasUnpublishedChanges}
      publishedAt={editor.publishedAt}
      versions={editor.versions}
      onSave={editor.save}
      onPublish={editor.publish}
      onLoadVersions={editor.loadVersions}
      onRestoreVersion={editor.restoreVersion}
      onResetToDefaults={editor.resetToDefaults}
    >
      {draft && (
        <>
          <SectionCard
            title="Isi kepala halaman"
            open={open.isi}
            onToggleOpen={() => setOpen((prev) => ({ ...prev, isi: !prev.isi }))}
          >
            <TextField
              label="Eyebrow"
              hint="Teks kecil di atas judul"
              value={draft.eyebrow}
              onChange={(eyebrow) => editor.update((prev) => ({ ...prev, eyebrow }))}
            />
            <TextField
              label="Judul"
              value={draft.title}
              onChange={(title) => editor.update((prev) => ({ ...prev, title }))}
            />
            <TextField
              label="Paragraf pengantar"
              multiline
              rows={4}
              value={draft.lead}
              onChange={(lead) => editor.update((prev) => ({ ...prev, lead }))}
            />
          </SectionCard>

          <SectionCard
            title="Metadata SEO halaman ini"
            description="Judul & deskripsi khusus halaman ini di Google"
            open={open.seo}
            onToggleOpen={() => setOpen((prev) => ({ ...prev, seo: !prev.seo }))}
          >
            <TextField
              label="Judul SEO"
              value={draft.seo.title}
              onChange={(title) =>
                editor.update((prev) => ({ ...prev, seo: { ...prev.seo, title } }))
              }
            />
            <TextField
              label="Deskripsi SEO"
              multiline
              value={draft.seo.description}
              onChange={(description) =>
                editor.update((prev) => ({ ...prev, seo: { ...prev.seo, description } }))
              }
            />
          </SectionCard>
        </>
      )}
    </SiteEditorShell>
  );
}
