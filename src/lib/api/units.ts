import { createClient } from '@/lib/supabase';
import type { BusinessUnit, BusinessUnitInsert, BusinessUnitUpdate } from '@/types';

/**
 * Data access untuk business_units (migr 117) — properti/kamar/villa fisik yang
 * bisa dibooking, terpisah dari catalog_items (layanan/rate plan). Tiap unit
 * punya kalender & occupancy sendiri.
 */

const SELECT_WITH_RATE_ITEM = `
  *,
  rate_item:catalog_items!business_units_rate_item_id_fkey(*)
`;

export async function getUnits(businessId: string, opts?: { activeOnly?: boolean }): Promise<BusinessUnit[]> {
  const supabase = createClient();
  let query = supabase
    .from('business_units')
    .select(SELECT_WITH_RATE_ITEM)
    .eq('business_id', businessId)
    .is('deleted_at', null);

  if (opts?.activeOnly) query = query.eq('is_active', true);

  const { data, error } = await query.order('sort_order', { ascending: true }).order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return data as BusinessUnit[];
}

export async function createUnit(insert: BusinessUnitInsert): Promise<BusinessUnit> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('business_units')
    .insert(insert)
    .select(SELECT_WITH_RATE_ITEM)
    .single();

  if (error) throw new Error(error.message);
  return data as BusinessUnit;
}

export async function updateUnit(id: string, updates: BusinessUnitUpdate): Promise<BusinessUnit> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('business_units')
    .update(updates)
    .eq('id', id)
    .select(SELECT_WITH_RATE_ITEM)
    .single();

  if (error) throw new Error(error.message);
  return data as BusinessUnit;
}

/** Soft-delete unit (histori booking yang menautnya tetap ada). */
export async function deleteUnit(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('business_units')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);
}
