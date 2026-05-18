import { createAdminClient } from '@/lib/supabase-server';
import type { OcrProvider } from './types';

/**
 * Format bulan saat ini dalam timezone Asia/Jakarta.
 * Returns string format 'YYYY-MM'.
 */
export function currentMonth(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = fmt.formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  return `${year}-${month}`;
}

/**
 * Ambil jumlah request bulan ini untuk provider tertentu.
 * Return 0 kalau belum ada record.
 */
export async function getMonthlyUsage(provider: OcrProvider): Promise<number> {
  const supabase = createAdminClient();
  const month = currentMonth();

  const { data, error } = await supabase
    .from('ocr_usage')
    .select('request_count')
    .eq('provider', provider)
    .eq('month', month)
    .maybeSingle();

  if (error) {
    console.error('[ocr/usage] getMonthlyUsage error:', error.message);
    return 0;
  }

  return data?.request_count ?? 0;
}

/**
 * Atomic increment counter pakai Postgres upsert + on conflict.
 * Return value baru setelah increment.
 */
export async function incrementUsage(provider: OcrProvider): Promise<number> {
  const supabase = createAdminClient();
  const month = currentMonth();

  // Pakai RPC untuk atomic increment. Kalau RPC tidak ada, fallback ke select+update.
  // Karena kita tidak define RPC custom, pakai approach: upsert dengan increment via raw SQL.
  // Supabase JS tidak support raw on-conflict expressions, jadi pakai 2-step transactional retry.

  // Try insert first (akan fail kalau sudah ada karena unique constraint)
  const { data: inserted, error: insertError } = await supabase
    .from('ocr_usage')
    .insert({ provider, month, request_count: 1 })
    .select('request_count')
    .maybeSingle();

  if (!insertError && inserted) {
    return inserted.request_count;
  }

  // Conflict (sudah ada record bulan ini) — increment via RPC or manual update
  // Pakai pattern: select current value, increment, update with optimistic check
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: current } = await supabase
      .from('ocr_usage')
      .select('id, request_count')
      .eq('provider', provider)
      .eq('month', month)
      .maybeSingle();

    if (!current) {
      // Race: row was deleted between insert and select. Retry insert.
      const { data: retry } = await supabase
        .from('ocr_usage')
        .insert({ provider, month, request_count: 1 })
        .select('request_count')
        .maybeSingle();
      if (retry) return retry.request_count;
      continue;
    }

    const newCount = current.request_count + 1;
    const { data: updated, error: updateError } = await supabase
      .from('ocr_usage')
      .update({ request_count: newCount, updated_at: new Date().toISOString() })
      .eq('id', current.id)
      .eq('request_count', current.request_count) // optimistic lock
      .select('request_count')
      .maybeSingle();

    if (!updateError && updated) {
      return updated.request_count;
    }
    // Optimistic lock failed → retry
  }

  // Last resort: return best-effort estimate
  console.error('[ocr/usage] incrementUsage exhausted retries for', provider);
  return await getMonthlyUsage(provider);
}
