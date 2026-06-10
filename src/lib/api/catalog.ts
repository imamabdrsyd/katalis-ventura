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
