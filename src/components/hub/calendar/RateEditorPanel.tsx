'use client';

import { useState, useMemo, useEffect } from 'react';
import { Tag, Loader2, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { listDatesInRange } from '@/lib/rates';
import { useLanguage } from '@/context/LanguageContext';

/** Urutan getUTCDay per chip hari (0=Min..6=Sab), urut Sen–Min ala grid. Label i18n. */
const DAY_DOWS = [1, 2, 3, 4, 5, 6, 0];

interface RateEditorPanelProps {
  /** Harga base weekday unit (utk placeholder input & konteks "default"). */
  defaultPrice: number;
  /** Rentang terpilih (anchor..end, inklusif) — panel yang memfilter per hari. */
  rangeStart: string;
  rangeEnd: string;
  /** Tanggal yang TAK boleh di-set harga (sudah dibooking) — dikecualikan dari rentang. */
  excludeDates?: Set<string>;
  onApply: (dates: string[], price: number) => Promise<void>;
  onReset: (dates: string[]) => Promise<void>;
  onClear: () => void;
}

/**
 * Panel set harga (pola Airbnb): tampil saat ada rentang tanggal terpilih. Override
 * harga per tanggal (menang atas base weekday/weekend item layanan) / reset ke base,
 * dengan filter hari (mis. hanya Jum+Sab untuk pola weekend). Tanggal yang sudah
 * dibooking (excludeDates) otomatis dilewati.
 */
export function RateEditorPanel({
  defaultPrice,
  rangeStart,
  rangeEnd,
  excludeDates,
  onApply,
  onReset,
  onClear,
}: RateEditorPanelProps) {
  const { t } = useLanguage();
  const c = t.calendar;
  const [price, setPrice] = useState('');
  const [activeDows, setActiveDows] = useState<Set<number>>(new Set(DAY_DOWS));
  const [busy, setBusy] = useState(false);

  // Reset input tiap ganti seleksi
  useEffect(() => {
    setPrice('');
    setActiveDows(new Set(DAY_DOWS));
  }, [rangeStart, rangeEnd]);

  const dates = useMemo(
    () =>
      listDatesInRange(rangeStart, rangeEnd, activeDows).filter(
        (d) => !excludeDates?.has(d)
      ),
    [rangeStart, rangeEnd, activeDows, excludeDates]
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
      toast.error(err instanceof Error ? err.message : c.reToastSaveFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleApply = () => {
    const p = Number(price);
    if (!price || Number.isNaN(p) || p < 0) return toast.error(c.reToastPriceValid);
    if (dates.length === 0) return toast.error(c.reToastNoDates);
    run(
      () => onApply(dates, p),
      c.reToastApplied.replace('{count}', String(dates.length)).replace('{price}', formatCurrency(p))
    );
  };

  const handleReset = () => {
    if (dates.length === 0) return toast.error(c.reToastNoDates);
    run(() => onReset(dates), c.reToastReset.replace('{count}', String(dates.length)));
  };

  const range = rangeStart === rangeEnd ? rangeStart : `${rangeStart} → ${rangeEnd}`;

  return (
    <div className="card-static p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 inline-flex items-center gap-2">
          <Tag className="w-4 h-4 text-primary-500 dark:text-primary-400" />
          {c.reTitle.replace('{range}', range)}
          <span className="font-normal text-gray-500 dark:text-gray-400">
            ({c.reNights.replace('{count}', String(dates.length))})
          </span>
        </p>
        <button type="button" onClick={onClear} className="btn-icon" aria-label={c.reCancel} title={c.reCancel}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filter hari */}
      <div className="flex flex-wrap items-center gap-1.5">
        {DAY_DOWS.map((dow, i) => {
          const active = activeDows.has(dow);
          return (
            <button
              key={dow}
              type="button"
              onClick={() => toggleDow(dow)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                active
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 ring-1 ring-inset ring-primary-200 dark:ring-primary-800'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
              aria-pressed={active}
            >
              {c.reDayChips[i]}
            </button>
          );
        })}
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">{c.reDayFilterHint}</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="number"
          min={0}
          className="input flex-1"
          placeholder={c.rePlaceholder.replace('{price}', formatCurrency(defaultPrice))}
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
            {c.reApply}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={busy}
            className="btn-ghost inline-flex items-center gap-1.5 disabled:opacity-50"
            title={c.reResetTitle}
          >
            <RotateCcw className="w-4 h-4" /> {c.reReset}
          </button>
        </div>
      </div>
    </div>
  );
}
