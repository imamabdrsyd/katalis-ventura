import { createClient } from '@/lib/supabase';
import type { CatalogItem, CatalogItemType, ServiceRole, RateKind } from '@/types';

export interface CatalogItemInsert {
  business_id: string;
  name: string;
  description?: string | null;
  item_type: CatalogItemType;
  default_price: number;
  unit?: string | null;
  unit_id?: string | null;
  service_role?: ServiceRole | null;
  rate_kind?: RateKind | null;
  revenue_account_id?: string | null;
  sku?: string | null;
  image_url?: string | null;
  image_fit?: 'cover' | 'contain' | null;
  image_position_x?: number | null;
  image_position_y?: number | null;
  link_url?: string | null;
  link_label?: string | null;
  track_stock?: boolean;
  stock_qty?: number;
  is_active?: boolean;
  sort_order?: number;
  created_by: string;
}

export interface CatalogItemUpdate {
  name?: string;
  description?: string | null;
  item_type?: CatalogItemType;
  default_price?: number;
  unit?: string | null;
  unit_id?: string | null;
  service_role?: ServiceRole | null;
  rate_kind?: RateKind | null;
  revenue_account_id?: string | null;
  sku?: string | null;
  image_url?: string | null;
  image_fit?: 'cover' | 'contain' | null;
  image_position_x?: number | null;
  image_position_y?: number | null;
  link_url?: string | null;
  link_label?: string | null;
  track_stock?: boolean;
  stock_qty?: number;
  is_active?: boolean;
  sort_order?: number;
}

const SELECT_WITH_ACCOUNT = `
  *,
  revenue_account:accounts!catalog_items_revenue_account_id_fkey(*)
`;

/**
 * Ambil item katalog bisnis (belum dihapus), urut by sort_order lalu name.
 *
 * `unitId` (migr 124): scope layanan per unit fisik akomodasi.
 *   - undefined → semua item bisnis (perilaku lama; POS/produk).
 *   - string    → hanya item unit itu.
 *   - null      → hanya item tanpa unit (produk / add-on lintas unit).
 */
export async function getCatalogItems(
  businessId: string,
  opts?: { activeOnly?: boolean; unitId?: string | null }
): Promise<CatalogItem[]> {
  const supabase = createClient();
  let query = supabase
    .from('catalog_items')
    .select(SELECT_WITH_ACCOUNT)
    .eq('business_id', businessId)
    .is('deleted_at', null);

  if (opts?.activeOnly) {
    query = query.eq('is_active', true);
  }

  if (opts && 'unitId' in opts) {
    query = opts.unitId == null ? query.is('unit_id', null) : query.eq('unit_id', opts.unitId);
  }

  const { data, error } = await query
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data as CatalogItem[];
}

/** Buat item katalog baru */
export async function createCatalogItem(item: CatalogItemInsert): Promise<CatalogItem> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('catalog_items')
    .insert(item)
    .select(SELECT_WITH_ACCOUNT)
    .single();

  if (error) throw new Error(error.message);
  return data as CatalogItem;
}

/** Update item katalog */
export async function updateCatalogItem(
  itemId: string,
  updates: CatalogItemUpdate
): Promise<CatalogItem> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('catalog_items')
    .update(updates)
    .eq('id', itemId)
    .select(SELECT_WITH_ACCOUNT)
    .single();

  if (error) throw new Error(error.message);
  return data as CatalogItem;
}

/**
 * Soft-delete item katalog (set deleted_at). Item tetap tersimpan untuk
 * integritas histori; tidak lagi muncul di list/picker.
 */
export async function deleteCatalogItem(itemId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('catalog_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', itemId);

  if (error) throw new Error(error.message);
}

/**
 * Kurangi stok item katalog setelah penjualan POS (RPC decrement_catalog_stock,
 * Migration 112). RPC hanya mengurangi item dengan track_stock=true milik bisnis
 * user; item tanpa track_stock diabaikan diam-diam (return null). Best-effort:
 * kegagalan stok TIDAK membatalkan transaksi yang sudah tercatat — caller
 * cukup log error.
 *
 * @returns sisa stok baru, atau null bila item tidak dilacak stoknya.
 */
export async function decrementStock(
  itemId: string,
  qty: number
): Promise<number | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('decrement_catalog_stock', {
    p_item_id: itemId,
    p_qty: qty,
  });

  if (error) throw new Error(error.message);
  return (data as number | null) ?? null;
}

/** Satu baris riwayat perubahan stok item katalog. */
export interface StockLogEntry {
  id: string;
  itemId: string;
  itemName: string;
  changedAt: string;
  changedByName: string | null;
  /** Stok sebelum perubahan */
  from: number;
  /** Stok sesudah perubahan */
  to: number;
  /** to - from; positif = barang masuk, negatif = terjual/koreksi turun */
  delta: number;
  /** Sumber perubahan (migr 123): 'pos_sale' = checkout kasir,
   *  'stock_add' = aksi Tambah Stok, null = manual/form (pra-migr 123). */
  source: string | null;
}

/**
 * Riwayat perubahan stok katalog sebuah bisnis.
 *
 * Dibaca dari `audit_trail_with_users` (trigger `log_audit_trail` sudah aktif di
 * `catalog_items` sejak migr 099) — TIDAK ada tabel log terpisah, jadi riwayat
 * lama pun ikut terbaca. Baris yang stok-nya tidak berubah difilter di client
 * karena PostgREST tak bisa membandingkan dua kolom JSONB.
 *
 * Mencakup semua sumber perubahan: tambah stok manual, checkout POS
 * (decrement_catalog_stock), dan koreksi lewat form edit item.
 */
export async function getStockLogs(
  businessId: string,
  limit: number = 30
): Promise<StockLogEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('audit_trail_with_users')
    .select('id, record_id, old_values, new_values, changed_at, changed_by_name, metadata')
    .eq('table_name', 'catalog_items')
    .eq('operation', 'UPDATE')
    .eq('metadata->>business_id', businessId)
    .order('changed_at', { ascending: false })
    // Ambil lebih banyak dari limit: sebagian besar UPDATE item katalog bukan
    // perubahan stok (rename, ganti harga) dan akan tersaring di bawah.
    .limit(limit * 10);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{
    id: string;
    record_id: string;
    old_values: Record<string, unknown> | null;
    new_values: Record<string, unknown> | null;
    changed_at: string;
    changed_by_name: string | null;
    metadata: Record<string, unknown> | null;
  }>;

  const logs: StockLogEntry[] = [];
  for (const r of rows) {
    const rawFrom = r.old_values?.stock_qty;
    const rawTo = r.new_values?.stock_qty;
    if (rawFrom == null || rawTo == null) continue;
    const from = Number(rawFrom);
    const to = Number(rawTo);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) continue;

    logs.push({
      id: r.id,
      itemId: r.record_id,
      itemName: String(r.new_values?.name ?? r.old_values?.name ?? '—'),
      changedAt: r.changed_at,
      changedByName: r.changed_by_name,
      from,
      to,
      delta: to - from,
      source: typeof r.metadata?.source === 'string' ? r.metadata.source : null,
    });
    if (logs.length >= limit) break;
  }
  return logs;
}

/**
 * Tambah stok item katalog (aksi "Tambah Stok" di halaman Katalog).
 * RPC increment_catalog_stock (Migration 120): atomik, hanya business manager,
 * hanya item track_stock=true. Return null bila guard tidak terpenuhi.
 *
 * @returns stok baru setelah penambahan, atau null bila item tidak memenuhi guard.
 */
export async function incrementStock(
  itemId: string,
  qty: number
): Promise<number | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('increment_catalog_stock', {
    p_item_id: itemId,
    p_qty: qty,
  });

  if (error) throw new Error(error.message);
  return (data as number | null) ?? null;
}
