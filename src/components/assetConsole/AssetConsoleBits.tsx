'use client';

import type { ReactNode } from 'react';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react';
import type { AssetClass } from '@/types';
import { ASSET_CLASS_BADGE_CLASS, ASSET_CLASS_META } from '@/lib/assetClasses';
import { useLanguage } from '@/context/LanguageContext';
import { formatCurrency } from '@/lib/utils';
import type { AssetHolding } from '@/lib/assetConsole';

/**
 * Label satuan kuantitas untuk kolom Unit/Balance.
 *
 * Untuk saham, kuantitas TRANSAKSI ("Lot") berbeda dari satuan HARGA
 * ("Lembar", tersimpan di `priceUnit`/catalog.unit) — 1 lot = 100 lembar.
 * Kelas lain (crypto/gold/property) tidak punya perbedaan ini: kuantitas
 * yang tercatat SUDAH dalam satuan harga akhir, jadi label-nya = unit
 * Katalog apa adanya (Coin, gram, unit, dst).
 */
export function quantityUnitLabel(holding: Pick<AssetHolding, 'assetClass' | 'priceUnit'>): string {
  if (holding.assetClass === 'stock') return 'Lot';
  return holding.priceUnit;
}

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
    // inline-flex + flex-wrap (bukan teks nowrap polos): pada KPI card sempit
    // dengan angka besar (mis. Rp 100.055.351 (+28.44%)), nilai dan
    // persentase turun ke baris sendiri alih-alih meluber keluar card.
    <span className={`inline-flex flex-wrap items-baseline gap-x-1.5 tabular-nums font-medium ${plColorClass(value)} ${className}`}>
      <span className="break-all">
        {sign}
        {formatCurrency(value)}
      </span>
      {pct !== undefined && Number.isFinite(pct) && (
        <span className="text-xs opacity-80 whitespace-nowrap">
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
  headerAction,
  children,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  /** Aksi opsional di pojok kanan header card (mis. toggle sensor nominal). */
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="card-static">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" aria-hidden />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300 truncate">{label}</p>
        </div>
        {headerAction}
      </div>
      <div className="text-2xl font-bold tabular-nums">{children}</div>
      {hint && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
    </div>
  );
}

/**
 * Toggle ikon mata netral untuk sensor nominal sensitif di KPI card. State
 * hanya di memori (bukan localStorage) — "sementara" per sesi/reload, sesuai
 * keputusan produk saat ini.
 */
export function SensitiveAmountToggle({
  visible,
  onToggle,
  labelShow,
  labelHide,
}: {
  visible: boolean;
  onToggle: () => void;
  labelShow: string;
  labelHide: string;
}) {
  const Icon = visible ? Eye : EyeOff;
  return (
    <button
      type="button"
      onClick={onToggle}
      title={visible ? labelHide : labelShow}
      aria-label={visible ? labelHide : labelShow}
      aria-pressed={!visible}
      className="p-1 -m-1 rounded-md text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors flex-shrink-0"
    >
      <Icon className="w-4 h-4" aria-hidden />
    </button>
  );
}

/** Ganti tiap digit dengan bintang, pertahankan simbol non-digit (Rp, titik, spasi, tanda +/-). */
export function maskAmount(formatted: string): string {
  return formatted.replace(/\d/g, '•');
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
