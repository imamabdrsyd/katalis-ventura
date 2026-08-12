'use client';

/**
 * CatalogQuickPicker
 *
 * Dipakai di Journal Entry untuk jenis transaksi "Penjualan". Sebelum
 * menampilkan form jurnal mentah, user memilih dulu produk/layanan dari katalog
 * bisnis — harga, nama, dan akun pendapatannya sudah tersimpan di sana, jadi
 * tidak perlu diketik ulang tiap kali menjual barang yang sama.
 *
 * Komponen ini TIDAK menyimpan transaksi. Ia hanya mengembalikan hasil pilihan
 * (item + qty) ke parent lewat `onSelect`, lalu parent mem-prefill form jurnal
 * biasa — user masih bisa mengubah nominal, akun, pelanggan, dsb.
 *
 * Kalau katalog kosong, parent langsung menampilkan form manual (lihat
 * journal-entry/page.tsx).
 */

import { useMemo, useState } from 'react';
import type { CatalogItem } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { Search, PenLine, Minus, Plus, Package, Wrench } from 'lucide-react';

interface CatalogQuickPickerProps {
  items: CatalogItem[];
  /** Dipanggil saat user memilih item — parent mem-prefill form jurnal. */
  onSelect: (item: CatalogItem, qty: number, total: number) => void;
  /** Escape hatch: user ingin isi form manual tanpa item katalog. */
  onManualEntry: () => void;
}

export function CatalogQuickPicker({ items, onSelect, onManualEntry }: CatalogQuickPickerProps) {
  const { t } = useLanguage();
  const tp = t.journalEntry.picker;
  const [search, setSearch] = useState('');
  const [qtyById, setQtyById] = useState<Record<string, number>>({});

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(kw) ||
        (i.description ?? '').toLowerCase().includes(kw) ||
        (i.sku ?? '').toLowerCase().includes(kw)
    );
  }, [items, search]);

  const qtyOf = (id: string) => qtyById[id] ?? 1;

  const setQty = (id: string, next: number) => {
    setQtyById((prev) => ({ ...prev, [id]: Math.max(1, next) }));
  };

  return (
    <div className="card-static space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
            {tp.catalogTitle}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{tp.catalogSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={onManualEntry}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
        >
          <PenLine className="w-4 h-4" />
          {tp.manualEntry}
        </button>
      </div>

      {items.length > 6 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tp.catalogSearchPlaceholder}
            className="input-search pl-9"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="px-4 py-6 text-sm text-center text-gray-500 dark:text-gray-400">
          {tp.catalogNoResults.replace('{keyword}', search)}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((item) => {
            const qty = qtyOf(item.id);
            const total = item.default_price * qty;
            const isService = item.item_type === 'service';
            const outOfStock =
              item.track_stock === true && (item.stock_qty ?? 0) <= 0;

            return (
              <div
                key={item.id}
                className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 flex flex-col gap-2 hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <span className="mt-0.5 shrink-0 text-gray-400 dark:text-gray-500">
                    {isService ? <Wrench className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatCurrency(item.default_price)}
                      {item.unit ? ` / ${item.unit}` : ''}
                      {item.track_stock
                        ? ` · ${tp.catalogStock.replace('{count}', String(item.stock_qty ?? 0))}`
                        : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setQty(item.id, qty - 1)}
                      disabled={qty <= 1}
                      className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
                      aria-label={tp.decreaseQty}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold text-gray-800 dark:text-gray-100">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty(item.id, qty + 1)}
                      className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      aria-label={tp.increaseQty}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelect(item, qty, total)}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    {tp.catalogSelect} · {formatCurrency(total)}
                  </button>
                </div>

                {outOfStock && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    {tp.catalogOutOfStock}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
