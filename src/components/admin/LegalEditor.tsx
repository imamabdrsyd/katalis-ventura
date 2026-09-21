'use client';

/**
 * Editor halaman legal (/privacy, /terms).
 *
 * Satu bahasa (Indonesia), sesuai isi dokumen yang tayang. Lihat catatan di
 * `ContentBlock` (types.ts) soal kenapa dokumen legal tidak dibuat dwibahasa.
 *
 * Peringatan di kepala halaman bukan hiasan: kedua URL ini diverifikasi Google
 * saat consent screen OAuth dipublish, jadi mengosongkan atau merusak isinya
 * punya akibat di luar tampilan situs.
 */

import { useState } from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useSiteEditor } from '@/hooks/useSiteEditor';
import { SiteEditorShell } from './SiteEditorShell';
import { SectionCard, TextField } from './SiteEditorFields';
import { BlockEditor, MarkupHint } from './BlockEditor';
import type { LegalContent } from '@/lib/site/types';

export function LegalEditor({ pageKey }: { pageKey: 'privacy' | 'terms' }) {
  const editor = useSiteEditor<LegalContent>(pageKey);
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({});
  const [metaOpen, setMetaOpen] = useState(true);

  const draft = editor.draft;
  const liveHref = pageKey === 'privacy' ? '/privacy' : '/terms';
  const title = pageKey === 'privacy' ? 'Kebijakan Privasi' : 'Syarat & Ketentuan';

  const toggleSection = (index: number) =>
    setOpenSections((prev) => ({ ...prev, [index]: !prev[index] }));

  const moveSection = (from: number, to: number) => {
    if (!draft || to < 0 || to >= draft.sections.length) return;
    editor.update((prev) => {
      const sections = [...prev.sections];
      const [moved] = sections.splice(from, 1);
      sections.splice(to, 0, moved);
      return { ...prev, sections };
    });
  };

  return (
    <SiteEditorShell
      title={title}
      description="Isi dokumen legal yang tayang di halaman publik."
      liveHref={liveHref}
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
          <div className="card-static border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-sm text-amber-900 dark:text-amber-100">
                <p className="font-semibold">Dokumen ini punya akibat di luar tampilan situs.</p>
                <p className="mt-1">
                  Google memverifikasi {liveHref} saat consent screen OAuth dipublish ke production.
                  Menghapus bagian tentang data Google, izin <code>drive.file</code>, atau komitmen{' '}
                  <em>Limited Use</em> bisa membuat verifikasi ditolak — dan login Google pengguna
                  ikut terdampak.
                </p>
              </div>
            </div>
          </div>

          <SectionCard
            title="Kepala dokumen"
            description="Judul, tanggal berlaku, pengantar, dan metadata"
            open={metaOpen}
            onToggleOpen={() => setMetaOpen((prev) => !prev)}
          >
            <TextField
              label="Judul"
              value={draft.title}
              onChange={(value) => editor.update((prev) => ({ ...prev, title: value }))}
            />
            <TextField
              label="Tanggal berlaku"
              hint="Ditampilkan apa adanya setelah kata “Berlaku sejak”, mis. 6 Agustus 2026"
              value={draft.effectiveDate}
              onChange={(value) => editor.update((prev) => ({ ...prev, effectiveDate: value }))}
            />
            <TextField
              label="Pengantar"
              multiline
              rows={4}
              value={draft.intro}
              onChange={(value) => editor.update((prev) => ({ ...prev, intro: value }))}
            />
            <TextField
              label="Judul SEO"
              value={draft.seo.title}
              onChange={(value) =>
                editor.update((prev) => ({ ...prev, seo: { ...prev.seo, title: value } }))
              }
            />
            <TextField
              label="Deskripsi SEO"
              multiline
              value={draft.seo.description}
              onChange={(value) =>
                editor.update((prev) => ({ ...prev, seo: { ...prev.seo, description: value } }))
              }
            />
          </SectionCard>

          <div className="card-static">
            <MarkupHint />
          </div>

          {draft.sections.map((section, index) => (
            <SectionCard
              key={index}
              title={section.heading || `Bagian ${index + 1} (tanpa judul)`}
              description={`${section.blocks.length} blok`}
              open={Boolean(openSections[index])}
              onToggleOpen={() => toggleSection(index)}
            >
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => moveSection(index, index - 1)}
                  disabled={index === 0}
                  className="btn-ghost !py-1.5 text-xs"
                >
                  ↑ Naikkan
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(index, index + 1)}
                  disabled={index === draft.sections.length - 1}
                  className="btn-ghost !py-1.5 text-xs"
                >
                  ↓ Turunkan
                </button>
                <button
                  type="button"
                  onClick={() =>
                    editor.update((prev) => ({
                      ...prev,
                      sections: prev.sections.filter((_, i) => i !== index),
                    }))
                  }
                  className="btn-ghost ml-auto inline-flex items-center gap-1.5 !py-1.5 text-xs text-red-600 dark:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus bagian
                </button>
              </div>

              <TextField
                label="Judul bagian"
                hint="Nomor ditulis manual, mis. “3. Data Anda” — penomoran tidak otomatis"
                value={section.heading}
                onChange={(heading) =>
                  editor.update((prev) => ({
                    ...prev,
                    sections: prev.sections.map((existing, i) =>
                      i === index ? { ...existing, heading } : existing
                    ),
                  }))
                }
              />

              <div>
                <span className="label">Isi bagian</span>
                <BlockEditor
                  blocks={section.blocks}
                  onChange={(blocks) =>
                    editor.update((prev) => ({
                      ...prev,
                      sections: prev.sections.map((existing, i) =>
                        i === index ? { ...existing, blocks } : existing
                      ),
                    }))
                  }
                />
              </div>
            </SectionCard>
          ))}

          <button
            type="button"
            onClick={() =>
              editor.update((prev) => ({
                ...prev,
                sections: [
                  ...prev.sections,
                  { heading: `${prev.sections.length + 1}. Bagian baru`, blocks: [] },
                ],
              }))
            }
            className="btn-ghost inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Tambah bagian
          </button>
        </>
      )}
    </SiteEditorShell>
  );
}
