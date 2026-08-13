'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import FloatingField from './FloatingField';
import { useLanguage } from '@/context/LanguageContext';

interface NumberStepperFieldProps {
  label: ReactNode;
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Besar loncatan tombol −/+ (default 1). Ketik manual tetap bebas desimal. */
  step?: number;
  /** Satuan yang ditampilkan di kiri tombol, mis. "pcs" */
  unit?: ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/** Bulatkan sesuai presisi step supaya 0.1 + 0.2 tidak jadi 0.30000000000000004 */
function roundToStep(value: number, step: number): number {
  const decimals = (String(step).split('.')[1] ?? '').length;
  return decimals > 0 ? Number(value.toFixed(decimals)) : value;
}

/**
 * Field angka dengan tombol −/+ eksplisit.
 *
 * KENAPA ADA: spinner bawaan `<input type="number">` TIDAK dirender sama sekali
 * di browser mobile (iOS Safari, Chrome Android), dan di desktop pun target
 * kliknya terlalu kecil. Komponen ini mematikan spinner native lalu menyediakan
 * tombol sendiri, jadi tampilannya sama di semua ukuran layar.
 *
 * Ketik manual tetap bisa (termasuk desimal); nilai di-clamp ke min/max saat
 * blur. Selama fokus, isian dibiarkan apa adanya supaya bisa dikosongkan
 * sementara tanpa langsung dipaksa jadi 0.
 */
export function NumberStepperField({
  label,
  value,
  onValueChange,
  min,
  max,
  step = 1,
  unit,
  disabled = false,
  id,
  className = '',
}: NumberStepperFieldProps) {
  const { t } = useLanguage();
  // null = tampilkan `value` dari props; string = isian mentah saat diketik
  const [raw, setRaw] = useState<string | null>(null);

  const clamp = (n: number) => {
    let next = n;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    return next;
  };

  const commit = (n: number) => onValueChange(clamp(roundToStep(n, step)));

  const stepBy = (direction: 1 | -1) => {
    setRaw(null);
    commit(value + direction * step);
  };

  const atMin = min !== undefined && value <= min;
  const atMax = max !== undefined && value >= max;

  return (
    <FloatingField
      id={id}
      label={label}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step="any"
      disabled={disabled}
      value={raw ?? String(value)}
      onChange={(e) => {
        setRaw(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value !== '' && Number.isFinite(n)) onValueChange(n);
      }}
      onBlur={() => {
        setRaw(null);
        commit(Number.isFinite(value) ? value : (min ?? 0));
      }}
      // Spinner native dimatikan — tombol −/+ di bawah yang menggantikannya
      className={`tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 ${className}`}
      // Ruang kanan disesuaikan isi trailing: 2 tombol (±64px) + satuan bila ada
      trailingPad={unit ? 'pr-36' : 'pr-20'}
      trailing={
        <span className="flex items-center gap-1.5">
          {unit && (
            <span className="text-sm text-gray-400 dark:text-gray-500 max-w-[4rem] truncate">
              {unit}
            </span>
          )}
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => stepBy(-1)}
              disabled={disabled || atMin}
              aria-label={t.common.decrease}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => stepBy(1)}
              disabled={disabled || atMax}
              aria-label={t.common.increase}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </span>
        </span>
      }
    />
  );
}

export default NumberStepperField;
