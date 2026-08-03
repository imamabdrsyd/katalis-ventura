'use client';

import type { ReactNode } from 'react';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react';
import type { AssetClass } from '@/types';
import { ASSET_CLASS_BADGE_CLASS, ASSET_CLASS_META, assetClassLabelKey } from '@/lib/assetClasses';
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

/**
 * Persen kepemilikan venture. Dipisah dari `formatQuantity` karena satuannya
 * melekat pada angkanya ("2,65%", tanpa spasi) — beda dari lot/coin/gram yang
 * label satuannya tampil terpisah dengan gaya redup.
 */
export function formatOwnershipPct(pct: number): string {
  return `${new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pct)}%`;
}

/** Label kelas aset dari i18n tanpa menyebar literal kelas ke seluruh UI. */
export function useAssetClassLabel(): (cls: AssetClass) => string {
  const { t } = useLanguage();
  return (cls) => t.assetConsole[assetClassLabelKey(cls)];
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
  wrap = true,
}: {
  value: number;
  pct?: number;
  className?: string;
  /**
   * true (default) = boleh wrap ke baris baru saat sempit — dipakai di KPI
   * card yang lebarnya terbatas (xl:grid-cols-4) dengan angka besar.
   * false = paksa satu baris — WAJIB di sel tabel, di mana ruang horizontal
   * cukup tapi baris antar-instrumen harus sejajar tinggi. Baris dengan
   * persentase lebih panjang (mis. "(+28.57%)" vs "(+14.33%)") akan wrap
   * beda-beda kalau dibiarkan default, membuat kolom P/L antar baris tidak
   * rata (bug nyata: baris Studio Unit turun ke 2 baris, baris lain tidak).
   */
  wrap?: boolean;
}) {
  const sign = value > 0 ? '+' : '';
  return (
    <span
      className={`inline-flex items-baseline gap-x-1.5 tabular-nums font-medium ${
        wrap ? 'flex-wrap' : 'whitespace-nowrap'
      } ${plColorClass(value)} ${className}`}
    >
      <span className={wrap ? 'break-all' : ''}>
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

/**
 * Harga per satuan kutipan (lembar/gram/coin) — bukan currency bulat.
 *
 * Desimal hanya dipertahankan untuk harga KECIL (saham < Rp10.000/lembar,
 * mis. 4.186,13) di mana sen itu signifikan secara ekonomi. Untuk harga
 * besar (crypto seperti BTC ~Rp991 juta/coin), 2 desimal cuma noise visual
 * ("991.411.075,38" tidak lebih bermakna dari "991.411.075") — dibulatkan
 * ke integer.
 */
export function formatUnitPrice(price: number): string {
  const maximumFractionDigits = Math.abs(price) < 10_000 ? 2 : 0;
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(price);
}
