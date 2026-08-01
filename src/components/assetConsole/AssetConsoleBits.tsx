'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { AssetClass } from '@/types';
import { ASSET_CLASS_BADGE_CLASS, ASSET_CLASS_META } from '@/lib/assetClasses';
import { useLanguage } from '@/context/LanguageContext';
import { formatCurrency } from '@/lib/utils';

/** Label kelas aset dari i18n tanpa menyebar literal kelas ke seluruh UI. */
export function useAssetClassLabel(): (cls: AssetClass) => string {
  const { t } = useLanguage();
  return (cls) =>
    t.assetConsole[
      `class${cls.charAt(0).toUpperCase()}${cls.slice(1)}` as
        'classStock' | 'classCrypto' | 'classProperty' | 'classGold'
    ];
}

export function AssetClassBadge({ assetClass }: { assetClass: AssetClass }) {
  const label = useAssetClassLabel()(assetClass);
  const Icon = ASSET_CLASS_META[assetClass].icon;
  return (
    <span className={ASSET_CLASS_BADGE_CLASS}>
      <Icon className="w-3 h-3" aria-hidden />
      {label}
    </span>
  );
}

/**
 * Nilai laba/rugi. Warna semantik (§1.2): emerald untuk untung, red untuk rugi,
 * abu-abu saat nol supaya tidak ada "hijau palsu" pada posisi tanpa harga.
 */
export function plColorClass(value: number): string {
  if (value > 0) return 'text-emerald-600 dark:text-emerald-400';
  if (value < 0) return 'text-red-600 dark:text-red-400';
  return 'text-gray-500 dark:text-gray-400';
}

export function PlValue({
  value,
  pct,
  className = '',
}: {
  value: number;
  pct?: number;
  className?: string;
}) {
  const sign = value > 0 ? '+' : '';
  return (
    <span className={`tabular-nums font-medium ${plColorClass(value)} ${className}`}>
      {sign}
      {formatCurrency(value)}
      {pct !== undefined && Number.isFinite(pct) && (
        <span className="ml-1.5 text-xs opacity-80">
          ({sign}
          {pct.toFixed(2)}%)
        </span>
      )}
    </span>
  );
}

/** KPI card — `.card-static` sesuai DESIGN_SYSTEM §3.5. */
export function KpiCard({
  icon: Icon,
  label,
  hint,
  children,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="card-static">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" aria-hidden />
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{label}</p>
      </div>
      <div className="text-2xl font-bold tabular-nums">{children}</div>
      {hint && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
    </div>
  );
}

/**
 * Format kuantitas: hindari "3.00000000 lot" tapi tetap presisi untuk kripto.
 */
export function formatQuantity(qty: number): string {
  if (!Number.isFinite(qty)) return '0';
  const rounded = Math.round(qty * 1e6) / 1e6;
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 8 }).format(rounded);
}

/** Harga per satuan kutipan (lembar/gram/coin) — bukan currency bulat. */
export function formatUnitPrice(price: number): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
}
