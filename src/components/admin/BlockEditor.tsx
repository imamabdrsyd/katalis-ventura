'use client';

/**
 * Editor `ContentBlock[]` — dipakai halaman legal, dan nanti body artikel.
 *
 * Tiap blok punya tipe tetap yang dipilih saat ditambahkan. Tipe TIDAK bisa
 * diubah setelah blok dibuat: mengubah paragraf jadi tabel berarti membuang
 * teksnya, dan itu kehilangan kerja yang tidak bisa dibatalkan. Hapus lalu
 * tambah blok baru lebih jujur soal apa yang terjadi.
 */

import { Plus, Trash2 } from 'lucide-react';
import type { ContentBlock } from '@/lib/site/types';

const BLOCK_LABELS: Record<ContentBlock['type'], string> = {
  paragraph: 'Paragraf',
  heading: 'Sub-judul',
  list: 'Daftar',
  callout: 'Blok sorot',
  table: 'Tabel',
  image: 'Gambar',
};

const CALLOUT_TONE_LABELS = {
  info: 'Netral',
  warning: 'Peringatan',
  success: 'Positif',
} as const;

function makeBlock(type: ContentBlock['type']): ContentBlock {
  switch (type) {
    case 'heading':
      return { type: 'heading', text: '' };
    case 'list':
      return { type: 'list', items: [''] };
    case 'callout':
      return { type: 'callout', tone: 'info', text: '' };
    case 'table':
      return { type: 'table', headers: ['', ''], rows: [['', '']] };
    case 'image':
      return { type: 'image', src: '/images/', alt: '' };
    default:
      return { type: 'paragraph', text: '' };
  }
}

/** Pengingat sintaks yang didukung — ditampilkan sekali per editor, bukan per blok. */
export function MarkupHint() {
  return (
    <p className="text-xs text-gray-500 dark:text-gray-400">
      Penekanan didukung: <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">**tebal**</code>,{' '}
      <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">*miring*</code>,{' '}
      <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">`kode`</code>, dan{' '}
      <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">[teks](url)</code>. HTML tidak
      dirender — sengaja, supaya form ini tidak bisa menyuntikkan kode ke halaman publik.
    </p>
  );
}

export function BlockEditor({
  blocks,
  onChange,
}: {
  blocks: ContentBlock[];
  onChange: (next: ContentBlock[]) => void;
}) {
  const replace = (index: number, block: ContentBlock) =>
    onChange(blocks.map((existing, i) => (i === index ? block : existing)));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => (
        <div
          key={index}
          className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {BLOCK_LABELS[block.type]}
            </span>
            <button
              type="button"
              onClick={() => move(index, index - 1)}
              disabled={index === 0}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-700 dark:hover:text-gray-200 cursor-pointer disabled:cursor-not-allowed"
              aria-label="Naikkan blok"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(index, index + 1)}
              disabled={index === blocks.length - 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-700 dark:hover:text-gray-200 cursor-pointer disabled:cursor-not-allowed"
              aria-label="Turunkan blok"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => onChange(blocks.filter((_, i) => i !== index))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 cursor-pointer"
              aria-label="Hapus blok"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {(block.type === 'paragraph' || block.type === 'heading') && (
            <textarea
              className="input"
              rows={block.type === 'heading' ? 1 : 4}
              value={block.text}
              onChange={(event) => replace(index, { ...block, text: event.target.value })}
            />
          )}

          {block.type === 'callout' && (
            <div className="space-y-2">
              <select
                className="input"
                value={block.tone}
                onChange={(event) =>
                  replace(index, {
                    ...block,
                    tone: event.target.value as typeof block.tone,
                  })
                }
              >
                {Object.entries(CALLOUT_TONE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <textarea
                className="input"
                rows={3}
                value={block.text}
                onChange={(event) => replace(index, { ...block, text: event.target.value })}
              />
            </div>
          )}

          {block.type === 'list' && (
            <div className="space-y-2">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={Boolean(block.ordered)}
                  onChange={(event) => replace(index, { ...block, ordered: event.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500 dark:border-gray-600"
                />
                Bernomor
              </label>
              {block.items.map((item, itemIndex) => (
                <div key={itemIndex} className="flex gap-2">
                  <textarea
                    className="input"
                    rows={2}
                    value={item}
                    onChange={(event) =>
                      replace(index, {
                        ...block,
                        items: block.items.map((existing, i) =>
                          i === itemIndex ? event.target.value : existing
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      replace(index, {
                        ...block,
                        items: block.items.filter((_, i) => i !== itemIndex),
                      })
                    }
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 cursor-pointer"
                    aria-label="Hapus butir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => replace(index, { ...block, items: [...block.items, ''] })}
                className="btn-ghost !py-1.5 text-xs"
              >
                Tambah butir
              </button>
            </div>
          )}

          {block.type === 'table' && (
            <TableBlockFields block={block} onChange={(next) => replace(index, next)} />
          )}

          {block.type === 'image' && (
            <div className="space-y-2">
              <input
                className="input"
                placeholder="/images/contoh.png"
                value={block.src}
                onChange={(event) => replace(index, { ...block, src: event.target.value })}
              />
              <input
                className="input"
                placeholder="Teks alternatif"
                value={block.alt}
                onChange={(event) => replace(index, { ...block, alt: event.target.value })}
              />
              <input
                className="input"
                placeholder="Keterangan (opsional)"
                value={block.caption ?? ''}
                onChange={(event) =>
                  replace(index, { ...block, caption: event.target.value || undefined })
                }
              />
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        {(Object.keys(BLOCK_LABELS) as ContentBlock['type'][]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onChange([...blocks, makeBlock(type)])}
            className="btn-ghost inline-flex items-center gap-1.5 !py-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            {BLOCK_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Tabel dipisah karena punya dua dimensi — kolom & baris diubah terpisah. */
function TableBlockFields({
  block,
  onChange,
}: {
  block: Extract<ContentBlock, { type: 'table' }>;
  onChange: (next: ContentBlock) => void;
}) {
  const columnCount = block.headers.length;

  const setColumnCount = (next: number) => {
    if (next < 1 || next > 8) return;
    const fit = (row: string[]) =>
      Array.from({ length: next }, (_, i) => row[i] ?? '');
    onChange({
      ...block,
      headers: fit(block.headers),
      rows: block.rows.map(fit),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <span>Kolom:</span>
        <button
          type="button"
          onClick={() => setColumnCount(columnCount - 1)}
          className="btn-ghost !px-3 !py-1 text-xs"
        >
          −
        </button>
        <span className="tabular-nums">{columnCount}</span>
        <button
          type="button"
          onClick={() => setColumnCount(columnCount + 1)}
          className="btn-ghost !px-3 !py-1 text-xs"
        >
          +
        </button>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Kepala kolom
        </span>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {block.headers.map((header, i) => (
            <input
              key={i}
              className="input min-w-[8rem]"
              value={header}
              onChange={(event) =>
                onChange({
                  ...block,
                  headers: block.headers.map((existing, j) =>
                    j === i ? event.target.value : existing
                  ),
                })
              }
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {block.rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex items-start gap-2">
            <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
              {row.map((cell, cellIndex) => (
                <input
                  key={cellIndex}
                  className="input min-w-[8rem]"
                  value={cell}
                  onChange={(event) =>
                    onChange({
                      ...block,
                      rows: block.rows.map((existingRow, i) =>
                        i === rowIndex
                          ? existingRow.map((existingCell, j) =>
                              j === cellIndex ? event.target.value : existingCell
                            )
                          : existingRow
                      ),
                    })
                  }
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                onChange({ ...block, rows: block.rows.filter((_, i) => i !== rowIndex) })
              }
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 cursor-pointer"
              aria-label="Hapus baris"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({ ...block, rows: [...block.rows, Array.from({ length: columnCount }, () => '')] })
          }
          className="btn-ghost !py-1.5 text-xs"
        >
          Tambah baris
        </button>
      </div>
    </div>
  );
}
