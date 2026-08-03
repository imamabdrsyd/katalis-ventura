/**
 * Data access Asset Console.
 *
 * Tidak ada tabel sendiri: seluruh angka diturunkan dari `catalog_items`
 * (master instrumen, opt-in lewat asset_class) + `transactions` (source of
 * truth). Lihat src/lib/assetConsole.ts untuk logika agregasinya.
 */

import { createClient } from '@/lib/supabase';
import type { AssetClass, CatalogItem, Transaction } from '@/types';
import { buildAssetHoldings, summarizeHoldings, type AssetConsoleSummary, type AssetHolding } from '@/lib/assetConsole';
import { getVentureSnapshots } from '@/lib/api/venture';

export interface AssetConsoleData {
  holdings: AssetHolding[];
  summary: AssetConsoleSummary;
  /** Instrumen yang di-set asset_class tapi belum punya transaksi sama sekali. */
  instruments: CatalogItem[];
}

/** Item katalog yang ditandai sebagai instrumen investasi. */
export async function getAssetInstruments(businessId: string): Promise<CatalogItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('catalog_items')
    .select('*')
    .eq('business_id', businessId)
    .not('asset_class', 'is', null)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as CatalogItem[];
}

/**
 * Ambil transaksi yang tertaut ke instrumen investasi.
 *
 * Filter `meta->catalog_item->>id IN (...)` dilakukan di server supaya bisnis
 * dengan ribuan transaksi tidak menarik semuanya ke browser hanya untuk
 * membuang sebagian besar. Butuh journal_lines + akun karena klasifikasi
 * beli/jual/dividen dibaca dari sisi debit/kredit akun posisi.
 */
export async function getAssetTransactions(
  businessId: string,
  instrumentIds: string[]
): Promise<Transaction[]> {
  if (instrumentIds.length === 0) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      debit_account:accounts!transactions_debit_account_id_fkey(*),
      credit_account:accounts!transactions_credit_account_id_fkey(*),
      journal_lines(*, account:accounts(*))
    `)
    .eq('business_id', businessId)
    .eq('status', 'posted')
    .is('deleted_at', null)
    .in('meta->catalog_item->>id', instrumentIds)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Transaction[];
}

/** Satu panggilan untuk seluruh halaman Asset Console. */
export async function getAssetConsoleData(businessId: string): Promise<AssetConsoleData> {
  const instruments = await getAssetInstruments(businessId);

  // Kelas 'venture' tidak punya transaksi di bisnis ini — angkanya dibaca dari
  // buku besar bisnis target. Dua sumber ini independen, jadi diambil paralel.
  const [transactions, ventureSnapshots] = await Promise.all([
    getAssetTransactions(
      businessId,
      instruments.map((i) => i.id)
    ),
    getVentureSnapshots(instruments),
  ]);

  const holdings = buildAssetHoldings(instruments, transactions, ventureSnapshots);
  return { holdings, summary: summarizeHoldings(holdings), instruments };
}

/**
 * Update harga pasar terakhir sebuah instrumen (input manual, Fase 1).
 *
 * `default_price` merangkap harga pasar supaya tidak ada dua sumber harga yang
 * bisa berbeda — kolom yang sama juga sudah tampil di halaman Katalog.
 */
export async function updateAssetLastPrice(itemId: string, price: number): Promise<CatalogItem> {
  if (!Number.isFinite(price) || price < 0) {
    throw new Error('Harga harus berupa angka tidak negatif');
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('catalog_items')
    .update({ default_price: price, asset_price_updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as CatalogItem;
}

/** Tandai / lepas item katalog sebagai instrumen investasi. */
export async function setAssetClass(
  itemId: string,
  assetClass: AssetClass | null,
  lotSize: number
): Promise<CatalogItem> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('catalog_items')
    .update({
      asset_class: assetClass,
      asset_lot_size: assetClass ? Math.max(lotSize, 0.00000001) : 1,
    })
    .eq('id', itemId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as CatalogItem;
}
