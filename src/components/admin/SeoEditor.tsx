'use client';

/**
 * Editor metadata SEO situs.
 *
 * Tidak dua bahasa: metadata dipasang satu kali di `<head>` root untuk seluruh
 * situs, dan situsnya berbahasa Indonesia (`locale: id_ID`). Menyediakan kolom
 * EN di sini hanya akan menyimpan nilai yang tidak pernah dipakai.
 */

import { useState } from 'react';
import { useSiteEditor } from '@/hooks/useSiteEditor';
import { SiteEditorShell } from './SiteEditorShell';
import { KeywordsField, SectionCard, TextField } from './SiteEditorFields';
import type { SeoContent } from '@/lib/site/types';

/** Ambang panjang yang lazim dipakai Google sebelum judul/deskripsi dipotong. */
const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;

function LengthHint({ value, limit }: { value: string; limit: number }) {
  const over = value.length > limit;
  return (
    <p
      className={`mt-1 text-xs ${
        over ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'
      }`}
    >
      {value.length}/{limit} karakter
      {over && ' — kemungkinan dipotong di hasil pencarian'}
    </p>
  );
}

export function SeoEditor() {
  const editor = useSiteEditor<SeoContent>('seo');
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({ dasar: true });

  const toggleCard = (key: string) =>
    setOpenCards((prev) => ({ ...prev, [key]: !prev[key] }));

  const draft = editor.draft;

  return (
    <SiteEditorShell
      title="Metadata SEO"
      description="Judul, deskripsi, dan kartu share yang muncul di Google, WhatsApp, dan LinkedIn."
      liveHref="/"
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
          <div className="card-static bg-gray-50 dark:bg-gray-900/40">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Favicon, URL kanonik, dan kode verifikasi Google sengaja tidak ada di sini.
              Nilainya terikat ke domain dan berkas di <code>/public</code> — salah ketik
              di situ merusak seluruh situs tanpa gejala yang kelihatan dari halaman ini.
            </p>
          </div>

          <SectionCard
            title="Judul & deskripsi"
            description="Yang tampil di hasil pencarian Google"
            open={Boolean(openCards.dasar)}
            onToggleOpen={() => toggleCard('dasar')}
          >
            <div>
              <TextField
                label="Judul situs"
                value={draft.siteTitle}
                onChange={(siteTitle) => editor.update((prev) => ({ ...prev, siteTitle }))}
              />
              <LengthHint value={draft.siteTitle} limit={TITLE_LIMIT} />
            </div>

            <TextField
              label="Template judul halaman"
              hint="%s diganti judul halaman masing-masing. Contoh: %s | AXION"
              value={draft.titleTemplate}
              onChange={(titleTemplate) => editor.update((prev) => ({ ...prev, titleTemplate }))}
            />

            <div>
              <TextField
                label="Deskripsi"
                multiline
                value={draft.description}
                onChange={(description) => editor.update((prev) => ({ ...prev, description }))}
              />
              <LengthHint value={draft.description} limit={DESCRIPTION_LIMIT} />
            </div>

            <KeywordsField
              label="Kata kunci"
              hint="Pisahkan dengan koma"
              value={draft.keywords}
              onChange={(keywords) => editor.update((prev) => ({ ...prev, keywords }))}
            />
          </SectionCard>

          <SectionCard
            title="Kartu share (Open Graph)"
            description="Tampilan saat link dibagikan ke WhatsApp, LinkedIn, Facebook"
            open={Boolean(openCards.og)}
            onToggleOpen={() => toggleCard('og')}
          >
            <TextField
              label="Judul"
              value={draft.openGraph.title}
              onChange={(title) =>
                editor.update((prev) => ({ ...prev, openGraph: { ...prev.openGraph, title } }))
              }
            />
            <TextField
              label="Deskripsi"
              multiline
              value={draft.openGraph.description}
              onChange={(description) =>
                editor.update((prev) => ({
                  ...prev,
                  openGraph: { ...prev.openGraph, description },
                }))
              }
            />
            <TextField
              label="Gambar"
              hint="Ukuran ideal 1200×630. Path di /public atau URL https."
              value={draft.openGraph.imageUrl}
              onChange={(imageUrl) =>
                editor.update((prev) => ({ ...prev, openGraph: { ...prev.openGraph, imageUrl } }))
              }
            />
            <TextField
              label="Teks alternatif gambar"
              value={draft.openGraph.imageAlt}
              onChange={(imageAlt) =>
                editor.update((prev) => ({ ...prev, openGraph: { ...prev.openGraph, imageAlt } }))
              }
            />
          </SectionCard>

          <SectionCard
            title="Kartu share (X / Twitter)"
            description="Judul & deskripsi khusus X — gambarnya ikut Open Graph"
            open={Boolean(openCards.twitter)}
            onToggleOpen={() => toggleCard('twitter')}
          >
            <TextField
              label="Judul"
              value={draft.twitter.title}
              onChange={(title) =>
                editor.update((prev) => ({ ...prev, twitter: { ...prev.twitter, title } }))
              }
            />
            <TextField
              label="Deskripsi"
              multiline
              value={draft.twitter.description}
              onChange={(description) =>
                editor.update((prev) => ({ ...prev, twitter: { ...prev.twitter, description } }))
              }
            />
            <TextField
              label="Akun pembuat"
              placeholder="@akun"
              value={draft.twitter.creator}
              onChange={(creator) =>
                editor.update((prev) => ({ ...prev, twitter: { ...prev.twitter, creator } }))
              }
            />
          </SectionCard>
        </>
      )}
    </SiteEditorShell>
  );
}
