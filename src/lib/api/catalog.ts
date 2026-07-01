import { createClient } from '@/lib/supabase';
import type { CatalogItem, CatalogItemType } from '@/types';

export interface CatalogItemInsert {
  business_id: string;
  name: string;
  description?: string | null;
  item_type: CatalogItemType;
  default_price: number;
  unit?: string | null;
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
  ical_import_url?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

const SELECT_WITH_ACCOUNT = `
  *,
  revenue_account:accounts!catalog_items_revenue_account_id_fkey(*)
`;

/** Ambil semua item katalog bisnis (belum dihapus), urut by sort_order lalu name */
export async function getCatalogItems(
  businessId: string,
  opts?: { activeOnly?: boolean }
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
