import { createClient } from '@/lib/supabase';
import type {
  FinancialSummary,
  IncomeStatementMetrics,
  BalanceSheetData,
  CashFlowData,
} from '@/types';

// ============================================
// Types
// ============================================

export type FinancialCacheType =
  | 'summary'
  | 'income_statement'
  | 'balance_sheet'
  | 'cash_flow'
  | 'dashboard';

export interface FinancialCacheRow<TPayload = unknown> {
  id: string;
  business_id: string;
  cache_type: FinancialCacheType;
  period_start: string | null;
  period_end: string | null;
  payload: TPayload;
  computed_at: string;
  computed_by: string | null;
  transaction_count: number;
  cache_version: number;
  is_stale: boolean;
}

// Payload shapes (satu per cache_type)
export type SummaryPayload = FinancialSummary;

export interface IncomeStatementPayload {
  summary: FinancialSummary;
  metrics: IncomeStatementMetrics;
}

export type BalanceSheetPayload = BalanceSheetData;

export type CashFlowPayload = CashFlowData;

export interface DashboardPayload {
  summary: FinancialSummary;
  roi: number;
  categoryCounts: Record<string, number>;
  balanceSheet: BalanceSheetData;
  capital: number;
}

// ============================================
// Version helper
// ============================================

/**
 * Ambil versi transaksi terkini untuk bisnis. Di-bump otomatis oleh trigger
 * `trg_bump_transaction_version` setiap kali transactions berubah.
 */
export async function getBusinessTransactionVersion(
  businessId: string
): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('business_transaction_versions')
    .select('transaction_version')
    .eq('business_id', businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data?.transaction_version as number | undefined) ?? 0;
}

// ============================================
// Read
// ============================================

export interface GetCacheInput {
  businessId: string;
  cacheType: FinancialCacheType;
  periodStart?: string | null;
  periodEnd?: string | null;
}

/**
 * Ambil cache yang valid (tidak stale & version cocok) untuk bisnis + tipe + periode.
 * Return null kalau cache tidak ada, stale, atau version sudah lebih lama dari current.
 */
export async function getFinancialCache<T = unknown>(
  input: GetCacheInput
): Promise<FinancialCacheRow<T> | null> {
  const supabase = createClient();
  const { businessId, cacheType } = input;

  let query = supabase
    .from('financial_summary_cache')
    .select('*')
    .eq('business_id', businessId)
    .eq('cache_type', cacheType);

  // Match NULL period dengan .is(), non-NULL dengan .eq()
  if (input.periodStart === null || input.periodStart === undefined) {
    query = query.is('period_start', null);
  } else {
    query = query.eq('period_start', input.periodStart);
  }
  if (input.periodEnd === null || input.periodEnd === undefined) {
    query = query.is('period_end', null);
  } else {
    query = query.eq('period_end', input.periodEnd);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const cache = data as FinancialCacheRow<T>;

  // Cross-check dengan version terkini
  if (cache.is_stale) return null;
  const currentVersion = await getBusinessTransactionVersion(businessId);
  if (cache.cache_version !== currentVersion) return null;

  return cache;
}

// ============================================
// Write
// ============================================

export interface UpsertCacheInput<T = unknown> {
  businessId: string;
  cacheType: FinancialCacheType;
  periodStart?: string | null;
  periodEnd?: string | null;
  payload: T;
  transactionCount: number;
  computedBy?: string;
}

/**
 * Simpan/update cache hasil kalkulasi. Version diambil dari
 * `business_transaction_versions` saat simpan — supaya cocok dengan state
 * transaksi saat kalkulasi dilakukan.
 */
export async function upsertFinancialCache<T = unknown>(
  input: UpsertCacheInput<T>
): Promise<FinancialCacheRow<T>> {
  const supabase = createClient();
  const version = await getBusinessTransactionVersion(input.businessId);

  // Hapus cache lama untuk kombinasi yang sama (unique index handle-nya ribet
  // karena COALESCE — lebih aman delete-then-insert)
  let delQuery = supabase
    .from('financial_summary_cache')
    .delete()
    .eq('business_id', input.businessId)
    .eq('cache_type', input.cacheType);

  if (input.periodStart === null || input.periodStart === undefined) {
    delQuery = delQuery.is('period_start', null);
  } else {
    delQuery = delQuery.eq('period_start', input.periodStart);
  }
  if (input.periodEnd === null || input.periodEnd === undefined) {
    delQuery = delQuery.is('period_end', null);
  } else {
    delQuery = delQuery.eq('period_end', input.periodEnd);
  }

  const { error: delErr } = await delQuery;
  if (delErr) throw new Error(delErr.message);

  const { data, error } = await supabase
    .from('financial_summary_cache')
    .insert({
      business_id: input.businessId,
      cache_type: input.cacheType,
      period_start: input.periodStart ?? null,
      period_end: input.periodEnd ?? null,
      payload: input.payload as any,
      transaction_count: input.transactionCount,
      cache_version: version,
      is_stale: false,
      computed_by: input.computedBy ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as FinancialCacheRow<T>;
}

/**
 * Paksa hapus semua cache bisnis — dipakai misalnya saat user klik "refresh data"
 * di UI, atau setelah rollback import batch.
 */
export async function invalidateAllFinancialCache(businessId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('financial_summary_cache')
    .delete()
    .eq('business_id', businessId);
  if (error) throw new Error(error.message);
}
