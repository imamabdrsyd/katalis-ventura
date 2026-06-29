'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ImageIcon, Loader2, Package, Check } from 'lucide-react';
import type { BusinessOmniChannel, CatalogItem } from '@/types';
import { upsertOmniChannel } from '@/lib/api/omniChannel';
import { getCatalogItems } from '@/lib/api/catalog';
import { formatCurrency } from '@/lib/utils';

interface Props {
  businessId: string;
  userId: string;
  channel: BusinessOmniChannel | null;
  onChanged: () => void;
}

/**
 * Konfigurasi widget "Produk Unggulan" di omni-channel.
 *
 * Widget ini WIRE dari katalog: manager memilih item katalog mana yang tampil di
 * halaman publik. Foto / crop / link CTA dikonfigurasi di item katalog itu sendiri
 * (halaman Catalog), bukan di sini. Yang disimpan ke omni-channel hanya daftar
 * `featured_item_ids` (urutan = urut tampil). Array kosong → widget tidak muncul.
 */
export function OmniChannelFeaturedProductConfig({ businessId, userId, channel, onChanged }: Props) {
  const initialIds = channel?.featured_item_ids ?? [];

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const savedRef = useRef<string[]>(initialIds);

  // Re-sync saat channel berubah (mis. setelah fetchChannel).
  useEffect(() => {
    const ids = channel?.featured_item_ids ?? [];
    setSelectedIds(ids);
    savedRef.current = ids;
  }, [channel?.featured_item_ids]);

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

  const hasChanges =
    selectedIds.length !== savedRef.current.length ||
    selectedIds.some((id, i) => id !== savedRef.current[i]);

  function toggleItem(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function handleSave() {
    if (!channel) return;
    setSaving(true);
    setSaveError('');
    try {
      await upsertOmniChannel(businessId, {
        slug: channel.slug,
        title: channel.title,
        tagline: channel.tagline ?? null,
        bio: channel.bio ?? null,
        logo_url: channel.logo_url ?? null,
        is_published: channel.is_published,
        featured_item_ids: selectedIds,
      }, userId);
      savedRef.current = selectedIds;
      onChanged();
    } catch (err: any) {
      setSaveError(err.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">Produk Unggulan</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Pilih item katalog yang ditampilkan di halaman publik.
            </p>
          </div>
        </div>
        {selectedIds.length > 0 && (
          <span className="shrink-0 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/15 rounded-full px-2.5 py-1">
            {selectedIds.length} dipilih
          </span>
        )}
      </div>

      {/* Item list */}
      {loadingItems ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-6">
          <Package className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada item katalog.</p>
          <Link href="/point-of-sales" className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
            Tambah item di Katalog →
          </Link>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {items.map(item => {
            const checked = selectedIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleItem(item.id)}
                className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  checked
                    ? 'border-indigo-300 dark:border-indigo-500/40 bg-indigo-50/60 dark:bg-indigo-500/10'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {/* Checkbox */}
                <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                  checked
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {checked && <Check className="w-3.5 h-3.5" />}
                </span>
                {/* Thumb */}
                <span className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center shrink-0 bg-gray-100 dark:bg-gray-700 text-gray-400">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-4 h-4" />
                  )}
                </span>
                {/* Info */}
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{item.name}</span>
                  <span className="block text-xs text-indigo-600 dark:text-indigo-400 font-medium tabular-nums">
                    {formatCurrency(item.default_price)}
                    {item.unit && <span className="text-gray-400 dark:text-gray-500 font-normal"> / {item.unit}</span>}
                  </span>
                </span>
                {!item.image_url && (
                  <span className="shrink-0 text-[10px] text-amber-600 dark:text-amber-400 font-medium">tanpa foto</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Atur foto, potong gambar, dan link beli tiap produk di halaman{' '}
          <Link href="/point-of-sales" className="text-indigo-600 dark:text-indigo-400 hover:underline">Katalog</Link>.
        </p>
      )}

      {saveError && <p className="text-sm text-red-500">{saveError}</p>}

      <button
        onClick={handleSave}
        disabled={saving || !hasChanges || !channel}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Menyimpan...</> : 'Simpan'}
      </button>
    </div>
  );
}
