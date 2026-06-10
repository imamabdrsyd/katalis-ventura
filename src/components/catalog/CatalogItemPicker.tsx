'use client';

import { useState, useEffect, useMemo } from 'react';
import type { CatalogItem } from '@/types';
import { getCatalogItems } from '@/lib/api/catalog';
import { formatCurrency } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { Package, Wrench, Search, Plus, Minus, ShoppingCart, X } from 'lucide-react';

export interface PickedCatalogLine {
  item: CatalogItem;
  qty: number;
  lineTotal: number; // qty * default_price
}

interface CatalogItemPickerProps {
  businessId: string;
  /**
   * 'multi' = keranjang (banyak item, qty per item) → dipakai di multi-line form.
   * 'single' = pilih satu item langsung → dipakai di quick entry.
   */
  mode: 'multi' | 'single';
  /** Mode multi: dipanggil saat user klik "Terapkan" dengan daftar item terpilih. */
  onApply?: (lines: PickedCatalogLine[]) => void;
  /** Mode single: dipanggil langsung saat user klik satu item. */
  onPick?: (item: CatalogItem) => void;
  onClose?: () => void;
}

export function CatalogItemPicker({
  businessId,
  mode,
  onApply,
  onPick,
  onClose,
}: CatalogItemPickerProps) {
  const { t } = useLanguage();
  const tc = t.catalog;
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // qty per item id (mode multi). 0 / absent = belum dipilih.
  const [cart, setCart] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!businessId) return;
      setLoading(true);
      try {
        const data = await getCatalogItems(businessId, { activeOnly: true });
        if (!cancelled) setItems(data);
      } catch (err) {
        console.error('Failed to load catalog items:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [businessId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.sku?.toLowerCase().includes(q) ?? false)
    );
  }, [items, search]);

  const cartLines = useMemo<PickedCatalogLine[]>(() => {
    return items
      .filter(i => (cart[i.id] ?? 0) > 0)
      .map(i => ({
        item: i,
        qty: cart[i.id],
        lineTotal: cart[i.id] * i.default_price,
      }));
  }, [items, cart]);

  const cartTotal = cartLines.reduce((s, l) => s + l.lineTotal, 0);

  function setQty(id: string, qty: number) {
    setCart(prev => {
      const next = { ...prev };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  function handleItemClick(item: CatalogItem) {
    if (mode === 'single') {
      onPick?.(item);
      return;
    }
    // multi: tambah 1 ke keranjang
    setQty(item.id, (cart[item.id] ?? 0) + 1);
  }

  if (loading) {
    return <div className="py-8 text-center text-sm text-gray-400">{tc.pickerLoading}</div>;
  }

  if (items.length === 0) {
    return (
      <div className="py-8 text-center">
        <Package className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">{tc.pickerEmpty}</p>
        <a href="/catalog" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-1 inline-block">
          {tc.pickerCreateLink}
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tc.pickerSearchPlaceholder}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Grid kotak item */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
        {filtered.map(item => {
          const Icon = item.item_type === 'service' ? Wrench : Package;
          const qty = cart[item.id] ?? 0;
          const selected = qty > 0;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleItemClick(item)}
              className={`relative text-left rounded-xl border p-3 transition-all ${
                selected
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-500'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-600'
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${
                item.item_type === 'service'
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-tight">
                {item.name}
              </p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-1 tabular-nums">
                {formatCurrency(item.default_price)}
              </p>
              {mode === 'multi' && selected && (
                <span className="absolute top-2 right-2 min-w-5 h-5 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {qty}
                </span>
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-full py-6 text-center text-sm text-gray-400">{tc.pickerNoMatch}</p>
        )}
      </div>

      {/* Keranjang (mode multi) */}
      {mode === 'multi' && cartLines.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            <ShoppingCart className="w-3.5 h-3.5" /> {tc.pickerSelectedItems}
          </div>
          {cartLines.map(line => (
            <div key={line.item.id} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-gray-700 dark:text-gray-200 truncate">{line.item.name}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setQty(line.item.id, line.qty - 1)}
                  className="w-6 h-6 rounded-md border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-7 text-center text-sm font-medium tabular-nums">{line.qty}</span>
                <button
                  type="button"
                  onClick={() => setQty(line.item.id, line.qty + 1)}
                  className="w-6 h-6 rounded-md border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <span className="w-24 text-right text-sm font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                {formatCurrency(line.lineTotal)}
              </span>
              <button
                type="button"
                onClick={() => setQty(line.item.id, 0)}
                className="text-gray-400 hover:text-red-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{tc.pickerTotal}</span>
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
              {formatCurrency(cartTotal)}
            </span>
          </div>
        </div>
      )}

      {/* Actions (mode multi) */}
      {mode === 'multi' && (
        <div className="flex gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {tc.cancel}
            </button>
          )}
          <button
            type="button"
            disabled={cartLines.length === 0}
            onClick={() => onApply?.(cartLines)}
            className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {tc.pickerApply} {cartLines.length > 0 && `(${cartLines.length})`}
          </button>
        </div>
      )}
    </div>
  );
}
