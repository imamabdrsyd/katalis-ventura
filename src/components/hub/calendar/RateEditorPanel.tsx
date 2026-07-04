'use client';

import { useState, useMemo, useEffect } from 'react';
import { Tag, Loader2, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import type { CatalogItem } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { listDatesInRange } from '@/lib/rates';

/** Chip hari: label + getUTCDay index (0=Min..6=Sab), urut Sen–Min ala grid. */
const DAY_CHIPS: { label: string; dow: number }[] = [
  { label: 'Sen', dow: 1 },
  { label: 'Sel', dow: 2 },
  { label: 'Rab', dow: 3 },
  { label: 'Kam', dow: 4 },
  { label: 'Jum', dow: 5 },
  { label: 'Sab', dow: 6 },
  { label: 'Min', dow: 0 },
];

interface RateEditorPanelProps {
  /** Item sumber harga unit ini (business_units.rate_item_id, hydrated). */
  rateItem: CatalogItem;
  /** Rentang terpilih (anchor..end, inklusif) — panel yang memfilter per hari. */
  rangeStart: string;
  rangeEnd: string;
  onApply: (dates: string[], price: number) => Promise<void>;
  onReset: (dates: string[]) => Promise<void>;
  onClear: () => void;
}

/**
 * Panel set harga mode Harga (pola Airbnb): tampil saat ada rentang tanggal
 * terpilih. Set harga / reset ke default untuk rentang, dengan filter hari
 * (mis. hanya Jum+Sab dalam rentang panjang = pola harga weekend). Mengganti
 * item sumber harga unit adalah aksi konfigurasi unit — ada di UnitManagerModal.
 */
export function RateEditorPanel({
  rateItem,
  rangeStart,
  rangeEnd,
  onApply,
  onReset,
  onClear,
}: RateEditorPanelProps) {
  const [price, setPrice] = useState('');
  const [activeDows, setActiveDows] = useState<Set<number>>(new Set(DAY_CHIPS.map((d) => d.dow)));
  const [busy, setBusy] = useState(false);

  // Reset input tiap ganti seleksi
  useEffect(() => {
    setPrice('');
    setActiveDows(new Set(DAY_CHIPS.map((d) => d.dow)));
  }, [rangeStart, rangeEnd]);

  const dates = useMemo(
    () => listDatesInRange(rangeStart, rangeEnd, activeDows),
    [rangeStart, rangeEnd, activeDows]
  );

  const toggleDow = (dow: number) => {
    setActiveDows((prev) => {
      const next = new Set(prev);
      if (next.has(dow)) next.delete(dow);
      else next.add(dow);
      return next;
    });
  };

  const run = async (fn: () => Promise<void>, successMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(successMsg);
      onClear();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan harga');
    } finally {
      setBusy(false);
    }
  };

  const handleApply = () => {
    const p = Number(price);
    if (!price || Number.isNaN(p) || p < 0) return toast.error('Isi harga yang valid.');
    if (dates.length === 0) return toast.error('Tidak ada tanggal yang cocok dengan filter hari.');
    run(() => onApply(dates, p), `Harga ${dates.length} malam di-set ${formatCurrency(p)}`);
  };

  const handleReset = () => {
    if (dates.length === 0) return toast.error('Tidak ada tanggal yang cocok dengan filter hari.');
    run(() => onReset(dates), `${dates.length} malam kembali ke harga default`);
  };

  const rangeLabel = rangeStart === rangeEnd ? rangeStart : `${rangeStart} → ${rangeEnd}`;

  return (
    <div className="card-static p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 inline-flex items-center gap-2">
          <Tag className="w-4 h-4 text-primary-500 dark:text-primary-400" />
          Set harga · {rangeLabel}
          <span className="font-normal text-gray-500 dark:text-gray-400">({dates.length} malam)</span>
        </p>
        <button type="button" onClick={onClear} className="btn-icon" aria-label="Batal pilih" title="Batal pilih">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filter hari */}
      <div className="flex flex-wrap items-center gap-1.5">
        {DAY_CHIPS.map((d) => {
          const active = activeDows.has(d.dow);
          return (
            <button
              key={d.dow}
              type="button"
              onClick={() => toggleDow(d.dow)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                active
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 ring-1 ring-inset ring-primary-200 dark:ring-primary-800'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
              aria-pressed={active}
            >
              {d.label}
            </button>
          );
        })}
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
          filter hari — mis. hanya Jum+Sab untuk harga weekend
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="number"
          min={0}
          className="input flex-1"
          placeholder={`Harga per malam (default ${formatCurrency(rateItem.default_price)})`}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleApply}
            disabled={busy}
            className="btn-primary inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
            Terapkan
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={busy}
            className="btn-ghost inline-flex items-center gap-1.5 disabled:opacity-50"
            title="Hapus harga khusus — kembali ke harga default item"
          >
            <RotateCcw className="w-4 h-4" /> Reset ke default
          </button>
        </div>
      </div>
    </div>
  );
}
