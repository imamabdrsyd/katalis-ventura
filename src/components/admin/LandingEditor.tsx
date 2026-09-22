'use client';

/**
 * Editor isi landing page.
 *
 * Tata letaknya mengikuti urutan halaman aslinya dari atas ke bawah — navbar,
 * hero, trust strip, section, closing, footer — supaya admin bisa memetakan apa
 * yang dia sunting ke apa yang dia lihat tanpa menebak.
 *
 * Kartu section dirender MENURUT `sectionOrder`, dan tombol panah di kartu itu
 * yang mengubah urutannya. Jadi "ubah urutan" dan "ubah isi" jadi satu tempat,
 * bukan dua daftar terpisah yang harus dicocokkan sendiri.
 */

import { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useSiteEditor } from '@/hooks/useSiteEditor';
import { SiteEditorShell } from './SiteEditorShell';
import {
  ArrayEditor,
  LocalizedField,
  SectionCard,
  TextField,
  emptyLocalized,
} from './SiteEditorFields';
import type { LandingContent, LandingSectionKey } from '@/lib/site/types';
import { anchorSectionKey, isSectionRendered } from '@/lib/site/landingNav';

const SECTION_META: Record<LandingSectionKey, { title: string; description: string }> = {
  accounting: {
    title: 'Section — Accounting Engine',
    description: 'Judul kiri + daftar bernomor di kanan',
  },
  ssot: {
    title: 'Section — Single Source of Truth',
    description: 'Judul + diagram alur laporan',
  },
  omnichannel: {
    title: 'Section — Omnichannel',
    description: 'Judul + panel omnichannel interaktif',
  },
  ecommerce: {
    title: 'Section — Ecommerce Integration',
    description: 'Judul + kotak logo marketplace',
  },
  health: {
    title: 'Section — Health Score',
    description: 'Judul + kalkulator skor kesehatan bisnis',
  },
};

/**
 * Nama section tujuan bila link ini menunjuk ke section yang tidak dirender —
 * `null` kalau tujuannya hidup, atau kalau link-nya bukan jangkar section.
 */
function hiddenTargetLabel(draft: LandingContent | null, href: string): string | null {
  if (!draft) return null;
  const key = anchorSectionKey(href);
  if (!key) return null;
  return isSectionRendered(draft, key) ? null : SECTION_META[key].title;
}

export function LandingEditor() {
  const editor = useSiteEditor<LandingContent>('landing');
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({ hero: true });

  const toggleCard = (key: string) =>
    setOpenCards((prev) => ({ ...prev, [key]: !prev[key] }));

  const draft = editor.draft;

  return (
    <SiteEditorShell
      title="Landing Page"
      description="Isi halaman depan axionventura.com — teks, urutan section, dan link."
      previewHref="/preview/landing"
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
          {/* ───────── Navbar ───────── */}
          <SectionCard
            title="Navbar"
            description="Menu atas & tombol login"
            open={Boolean(openCards.nav)}
            onToggleOpen={() => toggleCard('nav')}
          >
            <ArrayEditor
              label="Menu navigasi"
              items={draft.nav.items}
              max={8}
              addLabel="Tambah menu"
              itemLabel={(item) => item.label.id || item.key}
              makeEmpty={() => ({
                key: `menu-${Date.now()}`,
                label: emptyLocalized(),
                href: '#',
                visible: true,
              })}
              onChange={(items) =>
                editor.update((prev) => ({ ...prev, nav: { ...prev.nav, items } }))
              }
              renderItem={(item, _index, onItemChange) => (
                <>
                  {/* Menu yang menunjuk ke section tersembunyi ikut hilang dari
                      navbar, apa pun isi centang di bawah. Tanpa penanda ini,
                      centang "Tampilkan menu ini" terlihat rusak. */}
                  {hiddenTargetLabel(draft, item.href) && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                      Menu ini menunjuk ke {hiddenTargetLabel(draft, item.href)} yang sedang
                      disembunyikan, jadi ia tidak tampil di navbar. Tampilkan section itu
                      dulu bila menunya ingin muncul.
                    </p>
                  )}
                  <LocalizedField
                    label="Label"
                    value={item.label}
                    onChange={(label) => onItemChange({ ...item, label })}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      label="Link"
                      hint="Anchor ke section (#section-ssot) atau path (/blog)"
                      value={item.href}
                      onChange={(href) => onItemChange({ ...item, href })}
                    />
                    <div className="flex items-end pb-1">
                      <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={item.visible}
                          onChange={(event) =>
                            onItemChange({ ...item, visible: event.target.checked })
                          }
                          className="h-4 w-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500 dark:border-gray-600"
                        />
                        Tampilkan menu ini
                      </label>
                    </div>
                  </div>
                </>
              )}
            />

            <LocalizedField
              label="Tombol login"
              value={draft.nav.loginLabel}
              onChange={(loginLabel) =>
                editor.update((prev) => ({ ...prev, nav: { ...prev.nav, loginLabel } }))
              }
            />
          </SectionCard>

          {/* ───────── Hero ───────── */}
          <SectionCard
            title="Hero"
            description="Bagian paling atas — judul besar & tombol utama"
            open={Boolean(openCards.hero)}
            onToggleOpen={() => toggleCard('hero')}
          >
            <LocalizedField
              label="Eyebrow"
              hint="Teks kecil di atas judul"
              value={draft.hero.eyebrow}
              onChange={(eyebrow) =>
                editor.update((prev) => ({ ...prev, hero: { ...prev.hero, eyebrow } }))
              }
            />
            <LocalizedField
              label="Judul baris 1"
              value={draft.hero.title1}
              onChange={(title1) =>
                editor.update((prev) => ({ ...prev, hero: { ...prev.hero, title1 } }))
              }
            />
            <LocalizedField
              label="Judul baris 2"
              hint="Dirender lebih redup sebagai baris kedua"
              value={draft.hero.title2}
              onChange={(title2) =>
                editor.update((prev) => ({ ...prev, hero: { ...prev.hero, title2 } }))
              }
            />
            <LocalizedField
              label="Paragraf pembuka"
              multiline
              value={draft.hero.subtitle}
              onChange={(subtitle) =>
                editor.update((prev) => ({ ...prev, hero: { ...prev.hero, subtitle } }))
              }
            />

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Tombol utama
                </p>
                <LocalizedField
                  label="Label"
                  value={draft.hero.primaryCta.label}
                  onChange={(label) =>
                    editor.update((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, primaryCta: { ...prev.hero.primaryCta, label } },
                    }))
                  }
                />
                <TextField
                  label="Link"
                  value={draft.hero.primaryCta.href}
                  onChange={(href) =>
                    editor.update((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, primaryCta: { ...prev.hero.primaryCta, href } },
                    }))
                  }
                />
              </div>

              <div className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Tombol kedua
                </p>
                <LocalizedField
                  label="Label"
                  value={draft.hero.secondaryCta.label}
                  onChange={(label) =>
                    editor.update((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, secondaryCta: { ...prev.hero.secondaryCta, label } },
                    }))
                  }
                />
                <TextField
                  label="Link"
                  value={draft.hero.secondaryCta.href}
                  onChange={(href) =>
                    editor.update((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, secondaryCta: { ...prev.hero.secondaryCta, href } },
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Tangkapan layar (mode terang)"
                hint="Path di /public, contoh /images/landing-page-2.png"
                value={draft.hero.imageLight}
                onChange={(imageLight) =>
                  editor.update((prev) => ({ ...prev, hero: { ...prev.hero, imageLight } }))
                }
              />
              <TextField
                label="Tangkapan layar (mode gelap)"
                value={draft.hero.imageDark}
                onChange={(imageDark) =>
                  editor.update((prev) => ({ ...prev, hero: { ...prev.hero, imageDark } }))
                }
              />
            </div>
          </SectionCard>

          {/* ───────── Trust strip ───────── */}
          <SectionCard
            title="Trust strip"
            description="Angka statistik & marquee logo bisnis"
            open={Boolean(openCards.trust)}
            onToggleOpen={() => toggleCard('trust')}
            visible={draft.trustStrip.visible}
            onToggleVisible={() =>
              editor.update((prev) => ({
                ...prev,
                trustStrip: { ...prev.trustStrip, visible: !prev.trustStrip.visible },
              }))
            }
          >
            <div className="rounded-xl bg-gray-50 p-4 text-xs text-gray-600 dark:bg-gray-900/40 dark:text-gray-400">
              Angkanya dihitung otomatis dari data platform — yang bisa diubah di sini
              cuma labelnya. Bisnis mana yang muncul di marquee diatur lewat tombol
              &ldquo;tampilkan di logo slide&rdquo; pada masing-masing halaman bisnis.
            </div>

            <LocalizedField
              label="Eyebrow"
              value={draft.trustStrip.eyebrow}
              onChange={(eyebrow) =>
                editor.update((prev) => ({
                  ...prev,
                  trustStrip: { ...prev.trustStrip, eyebrow },
                }))
              }
            />
            <LocalizedField
              label="Label jumlah bisnis"
              value={draft.trustStrip.businessesLabel}
              onChange={(businessesLabel) =>
                editor.update((prev) => ({
                  ...prev,
                  trustStrip: { ...prev.trustStrip, businessesLabel },
                }))
              }
            />
            <LocalizedField
              label="Label jumlah pengguna"
              value={draft.trustStrip.usersLabel}
              onChange={(usersLabel) =>
                editor.update((prev) => ({
                  ...prev,
                  trustStrip: { ...prev.trustStrip, usersLabel },
                }))
              }
            />
            <LocalizedField
              label="Label privasi"
              value={draft.trustStrip.privacyLabel}
              onChange={(privacyLabel) =>
                editor.update((prev) => ({
                  ...prev,
                  trustStrip: { ...prev.trustStrip, privacyLabel },
                }))
              }
            />
          </SectionCard>

          {/* ───────── Section utama, urut sesuai sectionOrder ───────── */}
          {draft.sectionOrder.map((key, index) => {
            const section = draft.sections[key];
            const meta = SECTION_META[key];

            const moveSection = (to: number) => {
              if (to < 0 || to >= draft.sectionOrder.length) return;
              editor.update((prev) => {
                const order = [...prev.sectionOrder];
                const [moved] = order.splice(index, 1);
                order.splice(to, 0, moved);
                return { ...prev, sectionOrder: order };
              });
            };

            return (
              <div key={key} className="relative">
                <div className="absolute -left-2 top-4 z-10 flex -translate-x-full flex-col gap-1 max-lg:hidden">
                  <button
                    type="button"
                    onClick={() => moveSection(index - 1)}
                    disabled={index === 0}
                    aria-label={`Naikkan ${meta.title}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 transition-colors hover:text-gray-700 disabled:opacity-30 dark:border-gray-700 dark:bg-gray-800 dark:hover:text-gray-200 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(index + 1)}
                    disabled={index === draft.sectionOrder.length - 1}
                    aria-label={`Turunkan ${meta.title}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 transition-colors hover:text-gray-700 disabled:opacity-30 dark:border-gray-700 dark:bg-gray-800 dark:hover:text-gray-200 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>

                <SectionCard
                  title={meta.title}
                  description={meta.description}
                  open={Boolean(openCards[key])}
                  onToggleOpen={() => toggleCard(key)}
                  visible={section.visible}
                  onToggleVisible={() =>
                    editor.update((prev) => ({
                      ...prev,
                      sections: {
                        ...prev.sections,
                        [key]: { ...prev.sections[key], visible: !prev.sections[key].visible },
                      },
                    }))
                  }
                >
                  {/* Urutan versi layar kecil — panah samping disembunyikan di sana. */}
                  <div className="flex items-center gap-2 lg:hidden">
                    <button
                      type="button"
                      onClick={() => moveSection(index - 1)}
                      disabled={index === 0}
                      className="btn-ghost !py-1.5 text-xs"
                    >
                      ↑ Naikkan
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(index + 1)}
                      disabled={index === draft.sectionOrder.length - 1}
                      className="btn-ghost !py-1.5 text-xs"
                    >
                      ↓ Turunkan
                    </button>
                  </div>

                  <LocalizedField
                    label="Eyebrow"
                    value={section.eyebrow}
                    onChange={(eyebrow) =>
                      editor.update((prev) => ({
                        ...prev,
                        sections: {
                          ...prev.sections,
                          [key]: { ...prev.sections[key], eyebrow },
                        },
                      }))
                    }
                  />
                  <LocalizedField
                    label="Judul"
                    value={section.title}
                    onChange={(title) =>
                      editor.update((prev) => ({
                        ...prev,
                        sections: { ...prev.sections, [key]: { ...prev.sections[key], title } },
                      }))
                    }
                  />
                  <LocalizedField
                    label="Paragraf"
                    multiline
                    value={section.lead}
                    onChange={(lead) =>
                      editor.update((prev) => ({
                        ...prev,
                        sections: { ...prev.sections, [key]: { ...prev.sections[key], lead } },
                      }))
                    }
                  />

                  {key === 'accounting' && (
                    <ArrayEditor
                      label="Daftar bernomor"
                      items={draft.sections.accounting.items}
                      max={12}
                      addLabel="Tambah poin"
                      itemLabel={(item) => `${item.n} — ${item.title.id}`}
                      makeEmpty={() => ({
                        n: String(draft.sections.accounting.items.length + 1).padStart(2, '0'),
                        title: emptyLocalized(),
                        body: emptyLocalized(),
                      })}
                      onChange={(items) =>
                        editor.update((prev) => ({
                          ...prev,
                          sections: {
                            ...prev.sections,
                            accounting: { ...prev.sections.accounting, items },
                          },
                        }))
                      }
                      renderItem={(item, _i, onItemChange) => (
                        <>
                          <TextField
                            label="Nomor"
                            hint="Teks bebas — tampil sebagai penanda di kiri"
                            value={item.n}
                            onChange={(n) => onItemChange({ ...item, n })}
                          />
                          <LocalizedField
                            label="Judul poin"
                            value={item.title}
                            onChange={(title) => onItemChange({ ...item, title })}
                          />
                          <LocalizedField
                            label="Penjelasan"
                            multiline
                            rows={2}
                            value={item.body}
                            onChange={(body) => onItemChange({ ...item, body })}
                          />
                        </>
                      )}
                    />
                  )}

                  {key === 'ecommerce' && (
                    <ArrayEditor
                      label="Logo marketplace"
                      items={draft.sections.ecommerce.logos}
                      max={12}
                      addLabel="Tambah logo"
                      itemLabel={(item) => item.name || 'Tanpa nama'}
                      makeEmpty={() => ({ name: '', src: '/images/ecommerce/' })}
                      onChange={(logos) =>
                        editor.update((prev) => ({
                          ...prev,
                          sections: {
                            ...prev.sections,
                            ecommerce: { ...prev.sections.ecommerce, logos },
                          },
                        }))
                      }
                      renderItem={(item, _i, onItemChange) => (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <TextField
                            label="Nama"
                            value={item.name}
                            onChange={(name) => onItemChange({ ...item, name })}
                          />
                          <TextField
                            label="Berkas gambar"
                            hint="Path di /public"
                            value={item.src}
                            onChange={(src) => onItemChange({ ...item, src })}
                          />
                        </div>
                      )}
                    />
                  )}

                  {key === 'health' && (
                    <LocalizedField
                      label="Label link halaman penuh"
                      value={draft.sections.health.fullLinkLabel}
                      onChange={(fullLinkLabel) =>
                        editor.update((prev) => ({
                          ...prev,
                          sections: {
                            ...prev.sections,
                            health: { ...prev.sections.health, fullLinkLabel },
                          },
                        }))
                      }
                    />
                  )}
                </SectionCard>
              </div>
            );
          })}

          {/* ───────── Closing ───────── */}
          <SectionCard
            title="Closing CTA"
            description="Blok gelap sebelum footer"
            open={Boolean(openCards.closing)}
            onToggleOpen={() => toggleCard('closing')}
            visible={draft.closing.visible}
            onToggleVisible={() =>
              editor.update((prev) => ({
                ...prev,
                closing: { ...prev.closing, visible: !prev.closing.visible },
              }))
            }
          >
            <LocalizedField
              label="Eyebrow"
              value={draft.closing.eyebrow}
              onChange={(eyebrow) =>
                editor.update((prev) => ({ ...prev, closing: { ...prev.closing, eyebrow } }))
              }
            />
            <LocalizedField
              label="Judul"
              value={draft.closing.title}
              onChange={(title) =>
                editor.update((prev) => ({ ...prev, closing: { ...prev.closing, title } }))
              }
            />
            <LocalizedField
              label="Paragraf"
              multiline
              value={draft.closing.lead}
              onChange={(lead) =>
                editor.update((prev) => ({ ...prev, closing: { ...prev.closing, lead } }))
              }
            />
            <LocalizedField
              label="Label tombol"
              value={draft.closing.cta.label}
              onChange={(label) =>
                editor.update((prev) => ({
                  ...prev,
                  closing: { ...prev.closing, cta: { ...prev.closing.cta, label } },
                }))
              }
            />
            <TextField
              label="Link tombol"
              value={draft.closing.cta.href}
              onChange={(href) =>
                editor.update((prev) => ({
                  ...prev,
                  closing: { ...prev.closing, cta: { ...prev.closing.cta, href } },
                }))
              }
            />
          </SectionCard>

          {/* ───────── Footer ───────── */}
          <SectionCard
            title="Footer"
            description="Baris bawah — label legal, blog, kontak"
            open={Boolean(openCards.footer)}
            onToggleOpen={() => toggleCard('footer')}
          >
            <LocalizedField
              label="Tagline"
              value={draft.footer.label}
              onChange={(label) =>
                editor.update((prev) => ({ ...prev, footer: { ...prev.footer, label } }))
              }
            />
            <LocalizedField
              label="Label tombol login"
              value={draft.footer.cta.label}
              onChange={(label) =>
                editor.update((prev) => ({
                  ...prev,
                  footer: { ...prev.footer, cta: { ...prev.footer.cta, label } },
                }))
              }
            />
            <TextField
              label="Link tombol login"
              value={draft.footer.cta.href}
              onChange={(href) =>
                editor.update((prev) => ({
                  ...prev,
                  footer: { ...prev.footer, cta: { ...prev.footer.cta, href } },
                }))
              }
            />
            <LocalizedField
              label="Copyright"
              value={draft.footer.copyright}
              onChange={(copyright) =>
                editor.update((prev) => ({ ...prev, footer: { ...prev.footer, copyright } }))
              }
            />

            <div className="rounded-xl bg-gray-50 p-4 text-xs text-gray-600 dark:bg-gray-900/40 dark:text-gray-400">
              Target link Kebijakan Privasi &amp; Syarat Ketentuan sengaja tidak bisa diubah —
              Google memverifikasi kedua URL itu saat consent screen OAuth dipublish.
              Yang bisa disunting hanya labelnya.
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <LocalizedField
                label="Label Kebijakan Privasi"
                value={draft.footer.privacyLabel}
                onChange={(privacyLabel) =>
                  editor.update((prev) => ({
                    ...prev,
                    footer: { ...prev.footer, privacyLabel },
                  }))
                }
              />
              <LocalizedField
                label="Label Syarat & Ketentuan"
                value={draft.footer.termsLabel}
                onChange={(termsLabel) =>
                  editor.update((prev) => ({ ...prev, footer: { ...prev.footer, termsLabel } }))
                }
              />
            </div>

            <LocalizedField
              label="Label link blog"
              value={draft.footer.blogLabel}
              onChange={(blogLabel) =>
                editor.update((prev) => ({ ...prev, footer: { ...prev.footer, blogLabel } }))
              }
            />

            <ArrayEditor
              label="Link kontak & sosial"
              items={draft.footer.links}
              max={8}
              addLabel="Tambah link"
              itemLabel={(item) => item.label || 'Tanpa label'}
              makeEmpty={() => ({ label: '', href: 'https://' })}
              onChange={(links) =>
                editor.update((prev) => ({ ...prev, footer: { ...prev.footer, links } }))
              }
              renderItem={(item, _i, onItemChange) => (
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="Label"
                    hint="Ditampilkan apa adanya, tidak diterjemahkan"
                    value={item.label}
                    onChange={(label) => onItemChange({ ...item, label })}
                  />
                  <TextField
                    label="Link"
                    hint="https://… atau mailto:…"
                    value={item.href}
                    onChange={(href) => onItemChange({ ...item, href })}
                  />
                </div>
              )}
            />
          </SectionCard>
        </>
      )}
    </SiteEditorShell>
  );
}
