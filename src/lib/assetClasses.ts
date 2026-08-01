import { CandlestickChart, Bitcoin, Building2, Gem, type LucideIcon } from 'lucide-react';
import type { AssetClass } from '@/types';

/**
 * Metadata kelas aset — SATU tempat untuk menambah kelas baru.
 *
 * Menambah kelas: tambahkan entry di sini, tambahkan literalnya ke type
 * `AssetClass` (src/types/index.ts), longgarkan CHECK constraint
 * `catalog_items_asset_class_check` lewat migrasi baru, lalu tambahkan label
 * i18n di `t.assetConsole.class`. Tidak ada tempat lain yang meng-hardcode
 * daftar kelas.
 *
 * Sengaja TIDAK memakai warna per kelas: warna semantik di AXION dicadangkan
 * untuk kategori transaksi & main account (lihat DESIGN_SYSTEM §1.3). Kelas
 * aset dibedakan lewat ikon + label, badge-nya netral abu-abu.
 */
export interface AssetClassMeta {
  icon: LucideIcon;
  /** Satuan kuantitas default saat transaksi belum menuliskan satuannya. */
  defaultQtyUnit: string;
  /** Lot size wajar saat kelas ini dipilih pertama kali di form katalog. */
  suggestedLotSize: number;
}

export const ASSET_CLASS_META: Record<AssetClass, AssetClassMeta> = {
  stock: { icon: CandlestickChart, defaultQtyUnit: 'lot', suggestedLotSize: 100 },
  crypto: { icon: Bitcoin, defaultQtyUnit: 'coin', suggestedLotSize: 1 },
  property: { icon: Building2, defaultQtyUnit: 'unit', suggestedLotSize: 1 },
  gold: { icon: Gem, defaultQtyUnit: 'gram', suggestedLotSize: 1 },
};

export const ASSET_CLASSES = Object.keys(ASSET_CLASS_META) as AssetClass[];

export function isAssetClass(value: unknown): value is AssetClass {
  return typeof value === 'string' && value in ASSET_CLASS_META;
}

/** Badge netral untuk chip kelas aset (DESIGN_SYSTEM §3.4, varian ghost). */
export const ASSET_CLASS_BADGE_CLASS =
  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ' +
  'border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400';
