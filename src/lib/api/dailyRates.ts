import { createClient } from '@/lib/supabase';
import type { UnitDailyRate } from '@/types';

/**
 * Data access kalender harga (unit_daily_rates, migr 116).
 * Baris = override; hapus baris = tanggal kembali ke default_price item sumber.
 */

/** Ambil override harga untuk rentang [from, to] inklusif. */
export async function getDailyRates(
  catalogItemId: string,
  from: string,
  to: string
): Promise<UnitDailyRate[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('unit_daily_rates')
    .select('*')
    .eq('catalog_item_id', catalogItemId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true });

  if (error) throw new Error(error.message);
  return data as UnitDailyRate[];
}

/** Set harga untuk banyak tanggal sekaligus (upsert per tanggal). */
export async function upsertDailyRates(
  businessId: string,
  catalogItemId: string,
  dates: string[],
  price: number,
  userId: string
): Promise<void> {
  if (dates.length === 0) return;
  const supabase = createClient();
  const rows = dates.map((date) => ({
    business_id: businessId,
    catalog_item_id: catalogItemId,
    date,
    price,
    created_by: userId,
  }));
  const { error } = await supabase
    .from('unit_daily_rates')
    .upsert(rows, { onConflict: 'catalog_item_id,date' });

  if (error) throw new Error(error.message);
}

/** Hapus override (kembali ke harga default) untuk tanggal-tanggal tsb. */
export async function deleteDailyRates(
  catalogItemId: string,
  dates: string[]
): Promise<void> {
  if (dates.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase
    .from('unit_daily_rates')
    .delete()
    .eq('catalog_item_id', catalogItemId)
    .in('date', dates);

  if (error) throw new Error(error.message);
}

/** Tunjuk item katalog sebagai sumber harga dasar kalender bisnis. */
export async function setCalendarRateItem(
  businessId: string,
  catalogItemId: string | null
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('businesses')
    .update({ calendar_rate_item_id: catalogItemId })
    .eq('id', businessId);

  if (error) throw new Error(error.message);
}
