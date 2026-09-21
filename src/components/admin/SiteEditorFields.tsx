'use client';

/**
 * Primitif form untuk editor Site CMS.
 *
 * Satu pola yang konsisten di seluruh editor: teks yang tampil ke publik selalu
 * disunting BERDAMPINGAN dalam dua bahasa. Alternatifnya — tab ID/EN terpisah —
 * membuat terjemahan gampang tertinggal karena admin tidak melihat pasangannya
 * saat mengetik.
 */

import { useId } from 'react';
import { ChevronDown, Eye, EyeOff, GripVertical, Plus, Trash2 } from 'lucide-react';
import type { LocalizedText } from '@/lib/site/types';

// ─────────────────────────────────────────────────────────────────────────────
// Teks dua bahasa
// ─────────────────────────────────────────────────────────────────────────────

interface LocalizedFieldProps {
  label: string;
  value: LocalizedText;
  onChange: (next: LocalizedText) => void;
  hint?: string;
  multiline?: boolean;
  rows?: number;
}

export function LocalizedField({
  label,
  value,
  onChange,
  hint,
  multiline = false,
  rows = 3,
}: LocalizedFieldProps) {
  const id = useId();
  const Control = multiline ? 'textarea' : 'input';

  return (
    <div>
      <label className="label" htmlFor={`${id}-id`}>
        {label}
      </label>
      {hint && <p className="-mt-1 mb-2 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {(['id', 'en'] as const).map((locale) => (
          <div key={locale}>
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {locale === 'id' ? 'Indonesia' : 'English'}
            </span>
            <Control
              id={`${id}-${locale}`}
              className="input"
              {...(multiline ? { rows } : { type: 'text' })}
              value={value[locale]}
              onChange={(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                onChange({ ...value, [locale]: event.target.value })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Teks satu bahasa (link, nama berkas, metadata SEO)
// ─────────────────────────────────────────────────────────────────────────────

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  type?: 'text' | 'number';
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  placeholder,
  multiline = false,
  rows = 3,
  type = 'text',
}: TextFieldProps) {
  const id = useId();
  const Control = multiline ? 'textarea' : 'input';

  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {hint && <p className="-mt-1 mb-2 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
      <Control
        id={id}
        className="input"
        placeholder={placeholder}
        {...(multiline ? { rows } : { type })}
        value={value}
        onChange={(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          onChange(event.target.value)
        }
      />
    </div>
  );
}

/**
 * Daftar kata yang dipisah koma (kata kunci SEO).
 *
 * Disimpan sebagai array, disunting sebagai satu baris — untuk daftar pendek
 * yang jarang diubah, satu input jauh lebih cepat daripada satu baris per item.
 */
export function KeywordsField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  hint?: string;
}) {
  return (
    <TextField
      label={label}
      hint={hint}
      multiline
      rows={3}
      value={value.join(', ')}
      onChange={(raw) =>
        onChange(
          raw
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        )
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Kartu section: judul + toggle tampil/sembunyi + isi yang bisa dilipat
// ─────────────────────────────────────────────────────────────────────────────

interface SectionCardProps {
  title: string;
  description?: string;
  open: boolean;
  onToggleOpen: () => void;
  /** Tidak diberikan = section ini tidak bisa disembunyikan (mis. hero). */
  visible?: boolean;
  onToggleVisible?: () => void;
  children: React.ReactNode;
}

export function SectionCard({
  title,
  description,
  open,
  onToggleOpen,
  visible,
  onToggleVisible,
  children,
}: SectionCardProps) {
  const hideable = typeof visible === 'boolean' && Boolean(onToggleVisible);
  const dimmed = hideable && !visible;

  return (
    <div className="card-static !p-0 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4">
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          className="flex flex-1 items-center gap-3 text-left cursor-pointer"
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-gray-400 transition-transform dark:text-gray-500 ${
              open ? '' : '-rotate-90'
            }`}
          />
          <span className="min-w-0">
            <span
              className={`block truncate text-sm font-semibold ${
                dimmed
                  ? 'text-gray-400 dark:text-gray-500'
                  : 'text-gray-800 dark:text-gray-100'
              }`}
            >
              {title}
            </span>
            {description && (
              <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
                {description}
              </span>
            )}
          </span>
        </button>

        {hideable && (
          <button
            type="button"
            onClick={onToggleVisible}
            // 44px target — aksi utama per baris, sesuai ambang di DESIGN_SYSTEM §6.
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300 cursor-pointer"
            aria-label={visible ? `Sembunyikan ${title}` : `Tampilkan ${title}`}
            title={visible ? 'Sedang tampil — klik untuk sembunyikan' : 'Tersembunyi — klik untuk tampilkan'}
          >
            {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        )}
      </div>

      {open && (
        <div className="space-y-5 border-t border-gray-100 px-5 py-5 dark:border-gray-700">
          {children}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Editor daftar: tambah, hapus, geser
// ─────────────────────────────────────────────────────────────────────────────

interface ArrayEditorProps<T> {
  label: string;
  items: T[];
  onChange: (next: T[]) => void;
  /** Dipakai tombol "Tambah" untuk membuat item kosong. */
  makeEmpty: () => T;
  renderItem: (item: T, index: number, onItemChange: (next: T) => void) => React.ReactNode;
  itemLabel?: (item: T, index: number) => string;
  addLabel?: string;
  max?: number;
}

export function ArrayEditor<T>({
  label,
  items,
  onChange,
  makeEmpty,
  renderItem,
  itemLabel,
  addLabel = 'Tambah item',
  max,
}: ArrayEditorProps<T>) {
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const atMax = typeof max === 'number' && items.length >= max;

  return (
    <div>
      <span className="label">{label}</span>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={index}
            className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40"
          >
            <div className="mb-3 flex items-center gap-2">
              <GripVertical className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
              <span className="flex-1 truncate text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {itemLabel ? itemLabel(item, index) : `Item ${index + 1}`}
              </span>
              {/* 24px — baris padat, sesuai ambang di DESIGN_SYSTEM §6. */}
              <button
                type="button"
                onClick={() => move(index, index - 1)}
                disabled={index === 0}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-700 dark:hover:text-gray-200 cursor-pointer disabled:cursor-not-allowed"
                aria-label="Naikkan"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, index + 1)}
                disabled={index === items.length - 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-700 dark:hover:text-gray-200 cursor-pointer disabled:cursor-not-allowed"
                aria-label="Turunkan"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 cursor-pointer"
                aria-label="Hapus"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {renderItem(item, index, (next) =>
                onChange(items.map((existing, i) => (i === index ? next : existing)))
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange([...items, makeEmpty()])}
        disabled={atMax}
        className="btn-ghost mt-3 inline-flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        {atMax ? `Maksimal ${max} item` : addLabel}
      </button>
    </div>
  );
}

/** Nilai kosong untuk field dua bahasa yang baru ditambahkan. */
export const emptyLocalized = (): LocalizedText => ({ id: '', en: '' });
