import { createClient } from '@/lib/supabase';
import type { UnitDailyRate } from '@/types';

/**
 * Data access kalender harga (unit_daily_rates, migr 116/117).
 * Baris = override milik kalender SATU unit fisik; hapus baris = tanggal
 * kembali ke default_price item sumber harga unit tsb (business_units.rate_item_id).
 */

/** Ambil override harga untuk rentang [from, to] inklusif. */
export async function getDailyRates(
  unitId: string,
  from: string,
  to: string
): Promise<UnitDailyRate[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('unit_daily_rates')
    .select('*')
    .eq('unit_id', unitId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true });

  if (error) throw new Error(error.message);
  return data as UnitDailyRate[];
}

/** Set harga untuk banyak tanggal sekaligus (upsert per tanggal). */
export async function upsertDailyRates(
  businessId: string,
  unitId: string,
  dates: string[],
  price: number,
  userId: string
): Promise<void> {
  if (dates.length === 0) return;
  const supabase = createClient();
  const rows = dates.map((date) => ({
    business_id: businessId,
    unit_id: unitId,
    date,
    price,
    created_by: userId,
  }));
  const { error } = await supabase
    .from('unit_daily_rates')
    .upsert(rows, { onConflict: 'unit_id,date' });

  if (error) throw new Error(error.message);
}

/** Hapus override (kembali ke harga default) untuk tanggal-tanggal tsb. */
export async function deleteDailyRates(
  unitId: string,
  dates: string[]
): Promise<void> {
  if (dates.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase
    .from('unit_daily_rates')
    .delete()
    .eq('unit_id', unitId)
    .in('date', dates);

  if (error) throw new Error(error.message);
}
