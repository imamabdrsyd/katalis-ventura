import type { SupabaseClient } from '@supabase/supabase-js';
import { computeDedupHash } from './index';
import type { BankStatementParsed, StatementSource } from './types';

/**
 * Commit hasil parsing ke DB.
 * Atomic-ish:
 *   1. Insert bank_statement_imports (header)
 *   2. Insert bank_transactions (detail) dalam batch
 *   3. Update import status → 'committed'
 *
 * Dedup: pakai unique constraint (account_id, dedup_hash). Baris yang sudah ada
 * akan di-ignore. Statistik insert vs skipped di-return.
 */
export type CommitInput = {
  businessId: string;
  accountId: string;
  userId: string;
  source: StatementSource;
  fileName?: string;
  fileHash?: string;
  rawText: string;
  parsed: BankStatementParsed;
};

export type CommitResult = {
  import_id: string;
  inserted_rows: number;
  skipped_duplicates: number;
  total_rows: number;
};

export async function commitBankStatement(
  supabase: SupabaseClient,
  input: CommitInput
): Promise<CommitResult> {
  const { businessId, accountId, userId, source, parsed } = input;

  const { data: importHeader, error: headerErr } = await supabase
    .from('bank_statement_imports')
    .insert({
      business_id: businessId,
      account_id: accountId,
      source,
      bank_code: parsed.bank_code,
      period_start: parsed.period_start ?? null,
      period_end: parsed.period_end ?? null,
      opening_balance: parsed.opening_balance ?? null,
      closing_balance: parsed.closing_balance ?? null,
      total_credit: parsed.total_credit ?? null,
      total_debit: parsed.total_debit ?? null,
      raw_file_name: input.fileName ?? null,
      raw_file_hash: input.fileHash ?? null,
      raw_text: input.rawText,
      total_rows: parsed.rows.length,
      status: 'parsed',
      created_by: userId,
    })
    .select('id')
    .single();

  if (headerErr || !importHeader) {
    throw new Error(`Gagal simpan header import: ${headerErr?.message ?? 'unknown'}`);
  }

  const importId = importHeader.id as string;

  // Batch insert bank_transactions. UNIQUE(account_id, dedup_hash) akan filter duplicate.
  const rowsToInsert = parsed.rows.map(row => ({
    business_id: businessId,
    account_id: accountId,
    import_id: importId,
    posted_at: row.posted_at,
    value_date: row.value_date ?? null,
    description: row.description,
    amount: row.amount,
    running_balance: row.running_balance ?? null,
    reference_code: row.reference_code ?? null,
    counterparty_name: row.counterparty_name ?? null,
    raw_row: row,
    dedup_hash: computeDedupHash(row),
  }));

  // Pakai upsert dengan ignoreDuplicates=true supaya duplicate hash tidak error
  const { data: insertedRows, error: insertErr } = await supabase
    .from('bank_transactions')
    .upsert(rowsToInsert, {
      onConflict: 'account_id,dedup_hash',
      ignoreDuplicates: true,
    })
    .select('id');

  if (insertErr) {
    // Best-effort: tandai import gagal
    await supabase
      .from('bank_statement_imports')
      .update({ status: 'failed', parse_error: insertErr.message })
      .eq('id', importId);
    throw new Error(`Gagal insert bank_transactions: ${insertErr.message}`);
  }

  const inserted = insertedRows?.length ?? 0;
  const skipped = rowsToInsert.length - inserted;

  // Update header → committed
  await supabase
    .from('bank_statement_imports')
    .update({
      status: 'committed',
      committed_at: new Date().toISOString(),
    })
    .eq('id', importId);

  return {
    import_id: importId,
    inserted_rows: inserted,
    skipped_duplicates: skipped,
    total_rows: rowsToInsert.length,
  };
}
