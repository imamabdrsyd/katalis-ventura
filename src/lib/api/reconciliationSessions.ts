import { createClient } from '@/lib/supabase';

// ============================================
// Types
// ============================================

export type ReconciliationSessionStatus = 'in_progress' | 'completed' | 'discarded';

export interface ReconciliationSession {
  id: string;
  business_id: string;
  account_id: string | null;
  account_code: string | null;
  period_start: string;
  period_end: string;
  bank_statement_balance: number;
  book_balance_snapshot: number | null;
  difference: number | null;
  status: ReconciliationSessionStatus;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  completed_by: string | null;
}

export interface ReconciliationSessionMatch {
  id: string;
  session_id: string;
  transaction_id: string;
  matched_at: string;
  matched_by: string;
}

export interface UpsertReconciliationSessionInput {
  business_id: string;
  created_by: string;
  account_id?: string | null;
  account_code?: string | null;
  period_start: string;
  period_end: string;
  bank_statement_balance: number;
  book_balance_snapshot?: number | null;
  difference?: number | null;
  notes?: string | null;
}

// ============================================
// Queries
// ============================================

/**
 * Ambil sesi 'in_progress' paling baru untuk kombinasi business + period.
 * Dipanggil saat `useReconciliation` mount — supaya saldo bank yang sudah
 * user ketik sebelumnya ter-restore.
 */
export async function getActiveReconciliationSession(
  businessId: string,
  periodStart: string,
  periodEnd: string
): Promise<ReconciliationSession | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('reconciliation_sessions')
    .select('*')
    .eq('business_id', businessId)
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)
    .eq('status', 'in_progress')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as ReconciliationSession | null) ?? null;
}

/**
 * Ambil semua sesi rekonsiliasi bisnis, urut terbaru di atas.
 */
export async function getReconciliationSessions(
  businessId: string,
  options?: { limit?: number; status?: ReconciliationSessionStatus }
): Promise<ReconciliationSession[]> {
  const supabase = createClient();
  let query = supabase
    .from('reconciliation_sessions')
    .select('*')
    .eq('business_id', businessId)
    .order('period_end', { ascending: false });

  if (options?.status) query = query.eq('status', options.status);
  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ReconciliationSession[];
}

/**
 * Ambil semua transaksi yang sudah di-match dalam satu sesi.
 */
export async function getSessionMatchedTransactionIds(
  sessionId: string
): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('reconciliation_session_matches')
    .select('transaction_id')
    .eq('session_id', sessionId);

  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { transaction_id: string }) => r.transaction_id);
}

// ============================================
// Upsert / update
// ============================================

/**
 * Buat atau update sesi 'in_progress' untuk periode tertentu.
 * Karena ada UNIQUE index partial `uniq_recon_session_in_progress`, kita
 * cek dulu apakah sesi aktif sudah ada — kalau ada, update; kalau belum, insert.
 *
 * Ini adalah fungsi utama untuk auto-save saldo bank yang user ketik.
 */
export async function upsertActiveReconciliationSession(
  input: UpsertReconciliationSessionInput
): Promise<ReconciliationSession> {
  const supabase = createClient();

  const existing = await getActiveReconciliationSession(
    input.business_id,
    input.period_start,
    input.period_end
  );

  if (existing) {
    const { data, error } = await supabase
      .from('reconciliation_sessions')
      .update({
        bank_statement_balance: input.bank_statement_balance,
        book_balance_snapshot: input.book_balance_snapshot ?? null,
        difference: input.difference ?? null,
        notes: input.notes ?? existing.notes,
        account_id: input.account_id ?? existing.account_id,
        account_code: input.account_code ?? existing.account_code,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as ReconciliationSession;
  }

  const { data, error } = await supabase
    .from('reconciliation_sessions')
    .insert({
      business_id: input.business_id,
      created_by: input.created_by,
      account_id: input.account_id ?? null,
      account_code: input.account_code ?? null,
      period_start: input.period_start,
      period_end: input.period_end,
      bank_statement_balance: input.bank_statement_balance,
      book_balance_snapshot: input.book_balance_snapshot ?? null,
      difference: input.difference ?? null,
      notes: input.notes ?? null,
      status: 'in_progress',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ReconciliationSession;
}

/**
 * Tandai sesi sebagai completed (final) — misal setelah semua transaksi
 * dicocokkan dan selisih sudah nol.
 */
export async function completeReconciliationSession(
  sessionId: string,
  userId: string
): Promise<ReconciliationSession> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('reconciliation_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: userId,
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ReconciliationSession;
}

/**
 * Buang sesi 'in_progress' (user batal reconcile).
 */
export async function discardReconciliationSession(
  sessionId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('reconciliation_sessions')
    .update({ status: 'discarded' })
    .eq('id', sessionId);

  if (error) throw new Error(error.message);
}

// ============================================
// Match rows (progres parsial)
// ============================================

/**
 * Simpan daftar transaksi yang ditandai match di sesi ini.
 * Strategi: hapus semua match lama lalu insert ulang (atomic via array).
 * Dipanggil setelah user klik "Simpan Progres" atau saat pindah halaman.
 */
export async function saveSessionMatches(
  sessionId: string,
  transactionIds: string[],
  userId: string
): Promise<void> {
  const supabase = createClient();

  // Hapus match lama
  const { error: delErr } = await supabase
    .from('reconciliation_session_matches')
    .delete()
    .eq('session_id', sessionId);
  if (delErr) throw new Error(delErr.message);

  if (transactionIds.length === 0) return;

  // Insert baru
  const rows = transactionIds.map((tid) => ({
    session_id: sessionId,
    transaction_id: tid,
    matched_by: userId,
  }));
  const { error: insErr } = await supabase
    .from('reconciliation_session_matches')
    .insert(rows);

  if (insErr) throw new Error(insErr.message);
}
