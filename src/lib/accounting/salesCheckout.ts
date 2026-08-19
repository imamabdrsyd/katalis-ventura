/**
 * Resolver akun untuk checkout penjualan (pola Quick Entry) — dipakai bersama
 * oleh kasir POS (`useCashier`) dan booking kalender (`useCalendar`/`bookings` API).
 *
 * Saat menerima pembayaran EARN yang langsung lunas, sistem tak meminta user
 * memilih akun; akun Kas/Bank & Pendapatan di-resolve otomatis di sini agar
 * konsisten antar hub.
 */

import type { Account, CatalogItem } from '@/types';

export type PaymentMethod = 'cash' | 'qris';

/** Akun kas/bank counter sesuai metode: Tunai→kode 1100, QRIS→kode 1200. */
export function resolveCashAccount(accounts: Account[], method: PaymentMethod): Account | null {
  const preferredCode = method === 'cash' ? '1100' : '1200';
  const fallbackCode = method === 'cash' ? '1200' : '1100';
  const isCashEq = (a: Account) =>
    a.is_active &&
    a.account_type === 'ASSET' &&
    (a.is_cash_equivalent === true || a.account_code === '1100' || a.account_code === '1200');

  const pool = accounts.filter(isCashEq);
  return (
    pool.find((a) => a.account_code === preferredCode) ??
    pool.find((a) => a.account_code === fallbackCode) ??
    pool[0] ??
    null
  );
}

/** Akun pendapatan default bila item tak punya revenue_account_id (prefer 4100). */
export function resolveDefaultRevenueAccount(accounts: Account[]): Account | null {
  const revenue = accounts.filter(
    (a) => a.is_active && a.account_type === 'REVENUE' && a.parent_account_id != null
  );
  return revenue.find((a) => a.account_code === '4100') ?? revenue[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Jembatan stok → ledger (migr 134)
//
// Sebelum ini, checkout POS hanya mencatat sisi penjualan (Dr Kas / Cr
// Pendapatan) lalu mengurangi `stock_qty`. Pengurangan stok itu murni kuantitas:
// nilai barangnya tidak pernah dilepas dari akun Persediaan, sehingga aset
// overstated dan HPP tak pernah diakui di periode penjualan.
//
// `planCogsPosting` merakit rencana jurnal HPP tersendiri (Dr HPP / Cr
// Persediaan) bertanggal hari penjualan — BUKAN memutasi jurnal pembelian lama
// seperti `handleConvertStockToCOGS`, yang memindahkan beban ke periode
// pembelian dan melanggar matching principle.
// ─────────────────────────────────────────────────────────────────────────────

/** Akun beban yang sah menampung HPP. Struktural dulu (override → default_category),
 *  nama akun hanya cadangan terakhir — lihat larangan klasifikasi keyword-only. */
export function resolveCogsAccount(accounts: Account[]): Account | null {
  const expense = accounts.filter(
    (a) => a.is_active && a.account_type === 'EXPENSE' && a.parent_account_id != null
  );

  const isCostOfRevenue = (a: Account) =>
    a.income_statement_section === 'cost_of_revenue' ||
    (a.income_statement_section == null && a.default_category === 'VAR');

  return (
    expense.find(isCostOfRevenue) ??
    expense.find((a) => /\b(hpp|cogs)\b|harga pokok|biaya pokok/i.test(a.account_name)) ??
    // Sengaja TIDAK jatuh ke sembarang akun beban: membukukan HPP ke akun OPEX
    // diam-diam merusak Laba Kotor. Lebih baik tidak menjurnal sama sekali.
    null
  );
}

/** Akun ASSET tempat nilai persediaan disimpan. Struktural dulu, nama cadangan. */
export function resolveInventoryAccount(accounts: Account[]): Account | null {
  const assets = accounts.filter((a) => a.is_active && a.account_type === 'ASSET');
  return (
    assets.find((a) => a.default_category === 'VAR') ??
    assets.find((a) => /persediaan|inventory|stok|barang|bahan/i.test(a.account_name)) ??
    null
  );
}

export interface CogsCartLine {
  item: Pick<CatalogItem, 'id' | 'name' | 'track_stock' | 'cost_price'>;
  qty: number;
}

export interface CogsPostingPlan {
  cogsAccountId: string;
  inventoryAccountId: string;
  /** Total harga pokok yang dilepas (Rp), sudah dibulatkan 2 desimal. */
  total: number;
  items: { catalog_item_id: string; name: string; qty: number; unit_cost: number }[];
}

/**
 * Rencana jurnal HPP untuk satu keranjang. `null` = tidak ada yang perlu
 * dijurnal, dan itu jalur normal, bukan kegagalan.
 *
 * Menghasilkan null bila:
 * - **Bisnis tidak punya akun Persediaan.** Ini gerbang terpenting. Tanpa akun
 *   Persediaan, pembelian stok sudah dibebankan langsung ke HPP saat beli
 *   (model beban-saat-beli). Menjurnal HPP lagi saat jual = dobel hitung.
 *   Auto-HPP hanya benar untuk bisnis yang mengkapitalisasi pembelian ke aset.
 * - Tidak ada akun beban yang sah menampung HPP (lihat `resolveCogsAccount`).
 * - Tidak ada item ber-`track_stock` dengan `cost_price > 0` di keranjang.
 */
export function planCogsPosting(
  lines: CogsCartLine[],
  accounts: Account[]
): CogsPostingPlan | null {
  const inventoryAccount = resolveInventoryAccount(accounts);
  if (!inventoryAccount) return null;

  const cogsAccount = resolveCogsAccount(accounts);
  if (!cogsAccount) return null;

  // Akun yang sama di kedua sisi = jurnal nol, tak ada gunanya dicatat.
  if (cogsAccount.id === inventoryAccount.id) return null;

  const items = lines
    .filter((l) => l.item.track_stock === true && Number(l.item.cost_price) > 0 && l.qty > 0)
    .map((l) => ({
      catalog_item_id: l.item.id,
      name: l.item.name,
      qty: l.qty,
      unit_cost: Number(l.item.cost_price),
    }));
  if (items.length === 0) return null;

  const total =
    Math.round(items.reduce((sum, i) => sum + i.unit_cost * i.qty, 0) * 100) / 100;
  if (total <= 0) return null;

  return {
    cogsAccountId: cogsAccount.id,
    inventoryAccountId: inventoryAccount.id,
    total,
    items,
  };
}
