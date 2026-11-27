'use client';

/**
 * Konfigurasi kartu "Rate Card" di halaman publik (migr 152).
 *
 * Seperti Produk Unggulan, section ini WIRE dari katalog: yang disimpan hanya
 * daftar id item + urutannya + teks kartu. HARGA TIDAK PERNAH DISALIN ke sini —
 * diedit di halaman Katalog, supaya harga yang dipajang ke publik selalu harga
 * yang sama dengan yang dipakai saat mencatat pendapatan.
 *
 * Bedanya dari Produk Unggulan: di sini urutan punya arti (daftar harga dibaca
 * dari atas), jadi ada tombol naik/turun. Pemilihan lewat klik saja tidak cukup.
 */

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ListSkeleton } from '@/components/ui/PageSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChevronDown, ChevronUp, Check, Loader2, Package, ReceiptText } from 'lucide-react';
import type { BusinessOmniChannel, CatalogItem } from '@/types';
import { upsertOmniChannel } from '@/lib/api/omniChannel';
import { getCatalogItems } from '@/lib/api/catalog';
import { formatCurrency } from '@/lib/utils';

interface Props {
  businessId: string;
  userId: string;
  channel: BusinessOmniChannel | null;
  onChanged: () => void;
  /** Tujuan link "Katalog" — hub-nya berbeda per kategori usaha. */
  catalogHref: string;
  /** Toggle tampil/sembunyi di header, dikendalikan parent (pola section lain). */
  visibilityToggle?: React.ReactNode;
}

export function OmniChannelRateCardConfig({
  businessId,
  userId,
  channel,
  onChanged,
  catalogHref,
  visibilityToggle,
}: Props) {
  const initialIds = channel?.rate_card_item_ids ?? [];
  const initialTitle = channel?.rate_card_title ?? '';
  const initialNote = channel?.rate_card_note ?? '';

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds);
  const [title, setTitle] = useState(initialTitle);
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const savedRef = useRef({ ids: initialIds, title: initialTitle, note: initialNote });

  // Re-sync setelah fetchChannel (mis. section lain ikut menyimpan).
  useEffect(() => {
    const ids = channel?.rate_card_item_ids ?? [];
    const t = channel?.rate_card_title ?? '';
    const n = channel?.rate_card_note ?? '';
    setSelectedIds(ids);
    setTitle(t);
    setNote(n);
    savedRef.current = { ids, title: t, note: n };
  }, [channel?.rate_card_item_ids, channel?.rate_card_title, channel?.rate_card_note]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingItems(true);
      try {
        const data = await getCatalogItems(businessId, { activeOnly: true });
        if (alive) setItems(data);
      } catch {
        if (alive) setItems([]);
      } finally {
        if (alive) setLoadingItems(false);
      }
    })();
    return () => { alive = false; };
  }, [businessId]);

  const saved = savedRef.current;
  const hasChanges =
    title !== saved.title ||
    note !== saved.note ||
    selectedIds.length !== saved.ids.length ||
    selectedIds.some((id, i) => id !== saved.ids[i]);

  function toggleItem(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function move(id: string, dir: -1 | 1) {
    setSelectedIds((prev) => {
      const i = prev.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function handleSave() {
    if (!channel) return;
    setSaving(true);
    setSaveError('');
    try {
      await upsertOmniChannel(
        businessId,
        {
          slug: channel.slug,
          title: channel.title,
          tagline: channel.tagline ?? null,
          bio: channel.bio ?? null,
          logo_url: channel.logo_url ?? null,
          is_published: channel.is_published,
          rate_card_item_ids: selectedIds,
          rate_card_title: title.trim() || null,
          rate_card_note: note.trim() || null,
        },
        userId
      );
      savedRef.current = { ids: selectedIds, title, note };
      onChanged();
    } catch (err: any) {
      setSaveError(err.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  // Item terpilih tampil duluan sesuai urutan tampil di halaman publik; sisanya
  // menyusul. Tanpa ini, urutan yang baru diatur "hilang" di tengah daftar
  // panjang dan tombol naik/turun terasa tidak melakukan apa-apa.
  const selectedItems = selectedIds
    .map((id) => items.find((it) => it.id === id))
    .filter((it): it is CatalogItem => !!it);
  const unselectedItems = items.filter((it) => !selectedIds.includes(it.id));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ReceiptText className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">Rate Card</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Daftar harga di halaman publik. Harga dibaca dari Katalog.
            </p>
          </div>
        </div>
        {visibilityToggle}
      </div>

      {/* Teks kartu */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
            Judul kartu
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="Rate Card"
            className="input-field w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
            Catatan kecil <span className="text-gray-400">(opsional)</span>
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="Harga belum termasuk pajak"
            className="input-field w-full"
          />
        </div>
      </div>

      {/* Daftar item */}
      {loadingItems ? (
        <ListSkeleton rows={3} className="py-2" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Belum ada item katalog"
          size="sm"
          action={
            <Link href={catalogHref} className="btn-ghost">
              Tambah item di Katalog →
            </Link>
          }
        />
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {[...selectedItems, ...unselectedItems].map((item) => {
            const checked = selectedIds.includes(item.id);
            const pos = selectedIds.indexOf(item.id);
            return (
              <div
                key={item.id}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors ${
                  checked
                    ? 'border-indigo-300 dark:border-indigo-500/40 bg-indigo-50/60 dark:bg-indigo-500/10'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  aria-pressed={checked}
                >
                  <span
                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                      checked
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    {checked && <Check className="w-3.5 h-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                      {item.name}
                    </span>
                    <span className="block text-xs text-indigo-600 dark:text-indigo-400 font-medium tabular-nums">
                      {formatCurrency(item.default_price)}
                      {item.unit && (
                        <span className="text-gray-400 dark:text-gray-500 font-normal"> / {item.unit}</span>
                      )}
                    </span>
                  </span>
                </button>

                {checked && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => move(item.id, -1)}
                      disabled={pos === 0}
                      aria-label={`Naikkan ${item.name}`}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(item.id, 1)}
                      disabled={pos === selectedIds.length - 1}
                      aria-label={`Turunkan ${item.name}`}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Ubah nama, harga, dan satuan tiap baris di halaman{' '}
          <Link href={catalogHref} className="text-indigo-600 dark:text-indigo-400 hover:underline">
            Katalog
          </Link>
          .
        </p>
      )}

      {saveError && <p className="text-sm text-red-500">{saveError}</p>}

      <button
        onClick={handleSave}
        disabled={saving || !hasChanges || !channel}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Menyimpan...
          </>
        ) : (
          'Simpan'
        )}
      </button>
    </div>
  );
}
