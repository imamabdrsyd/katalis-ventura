import { CandlestickChart, Bitcoin, Building2, Gem, PieChart, type LucideIcon } from 'lucide-react';
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
  venture: { icon: PieChart, defaultQtyUnit: '%', suggestedLotSize: 1 },
};

export const ASSET_CLASSES = Object.keys(ASSET_CLASS_META) as AssetClass[];

/**
 * Kelas yang instrumennya didefinisikan lewat form Katalog (pilih kelas + lot
 * size pada item yang sudah ada). 'venture' sengaja di luar daftar ini: ia
 * bukan barang/jasa yang bisa dijual — tidak punya SKU, stok, atau harga jual —
 * dan ditautkan lewat tombol "Hubungkan Venture" di halaman Asset Console yang
 * memilih bisnis + akun ekuitas, bukan lewat form item katalog.
 */
export const CATALOG_ASSET_CLASSES = ASSET_CLASSES.filter((c) => c !== 'venture');

/**
 * Kelas yang angkanya BUKAN turunan transaksi bisnis ini, melainkan dibaca dari
 * buku besar bisnis lain (cap table + neraca). Konsekuensinya: tidak ada harga
 * manual, tidak ada riwayat transaksi lokal, dan tidak ada kustodian.
 */
export function isLinkedAssetClass(cls: AssetClass): boolean {
  return cls === 'venture';
}

/** Kunci i18n label kelas di `t.assetConsole` — satu tempat, supaya menambah
 *  kelas tidak menyisakan cast union usang yang tersebar di beberapa komponen. */
export type AssetClassLabelKey =
  | 'classStock'
  | 'classCrypto'
  | 'classProperty'
  | 'classGold'
  | 'classVenture';

export function assetClassLabelKey(cls: AssetClass): AssetClassLabelKey {
  return `class${cls.charAt(0).toUpperCase()}${cls.slice(1)}` as AssetClassLabelKey;
}

export function isAssetClass(value: unknown): value is AssetClass {
  return typeof value === 'string' && value in ASSET_CLASS_META;
}

/** Badge netral untuk chip kelas aset (DESIGN_SYSTEM §3.4, varian ghost). */
export const ASSET_CLASS_BADGE_CLASS =
  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ' +
  'border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400';
