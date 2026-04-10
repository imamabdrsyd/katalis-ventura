import { createClient } from '@/lib/supabase';

// ============================================
// Types
// ============================================

export type ImportBatchStatus =
  | 'pending'
  | 'success'
  | 'partial'
  | 'failed'
  | 'rolled_back';

export type ImportBatchMode = 'smart' | 'full';

export interface ImportBatchError {
  row?: number;
  column?: string;
  message: string;
}

export interface ImportBatch {
  id: string;
  business_id: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  import_mode: ImportBatchMode;
  total_rows: number;
  inserted_count: number;
  failed_count: number;
  status: ImportBatchStatus;
  errors: ImportBatchError[];
  notes: string | null;
  imported_by: string;
  imported_at: string;
  rolled_back_at: string | null;
  rolled_back_by: string | null;
  // Joined
  importer?: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

export interface CreateImportBatchInput {
  business_id: string;
  imported_by: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  import_mode: ImportBatchMode;
  total_rows: number;
  notes?: string;
}

export interface FinalizeImportBatchInput {
  id: string;
  inserted_count: number;
  failed_count: number;
  errors?: ImportBatchError[];
  status: ImportBatchStatus;
}

// ============================================
// Create & finalize
// ============================================

/**
 * Buat record import batch dengan status 'pending' sebelum mulai insert transaksi.
 * Return ID batch yang digunakan sebagai `import_batch_id` saat bulk insert.
 */
export async function createImportBatch(
  input: CreateImportBatchInput
): Promise<ImportBatch> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('import_batches')
    .insert({
      business_id: input.business_id,
      imported_by: input.imported_by,
      file_name: input.file_name,
      file_size: input.file_size ?? null,
      mime_type: input.mime_type ?? null,
      import_mode: input.import_mode,
      total_rows: input.total_rows,
      inserted_count: 0,
      failed_count: 0,
      status: 'pending',
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ImportBatch;
}

/**
 * Update batch dengan hasil akhir setelah proses insert selesai.
 */
export async function finalizeImportBatch(
  input: FinalizeImportBatchInput
): Promise<ImportBatch> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('import_batches')
    .update({
      inserted_count: input.inserted_count,
      failed_count: input.failed_count,
      errors: input.errors ?? [],
      status: input.status,
    })
    .eq('id', input.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ImportBatch;
}

// ============================================
// Queries
// ============================================

/**
 * Ambil riwayat import batch untuk satu bisnis (paling baru di atas).
 */
export async function getImportBatches(
  businessId: string,
  options?: { limit?: number }
): Promise<ImportBatch[]> {
  const supabase = createClient();
  let query = supabase
    .from('import_batches')
    .select(`
      *,
      importer:profiles!import_batches_imported_by_fkey(id, full_name, avatar_url)
    `)
    .eq('business_id', businessId)
    .order('imported_at', { ascending: false });

  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ImportBatch[];
}

/**
 * Ambil detail satu batch beserta jumlah transaksi yang masih aktif
 * (belum soft-deleted) untuk keperluan tombol rollback.
 */
export async function getImportBatchById(batchId: string): Promise<{
  batch: ImportBatch;
  activeTransactionCount: number;
}> {
  const supabase = createClient();

  const [{ data: batch, error: batchErr }, { count, error: countErr }] =
    await Promise.all([
      supabase
        .from('import_batches')
        .select(`
          *,
          importer:profiles!import_batches_imported_by_fkey(id, full_name, avatar_url)
        `)
        .eq('id', batchId)
        .single(),
      supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('import_batch_id', batchId)
        .is('deleted_at', null),
    ]);

  if (batchErr) throw new Error(batchErr.message);
  if (countErr) throw new Error(countErr.message);

  return {
    batch: batch as ImportBatch,
    activeTransactionCount: count ?? 0,
  };
}

// ============================================
// Rollback
// ============================================

/**
 * Soft-delete semua transaksi yang dibuat oleh suatu batch import.
 * Menggunakan `soft_delete_transaction` stored procedure agar trigger audit
 * tetap berjalan. Setelah sukses, status batch diubah menjadi 'rolled_back'.
 */
export async function rollbackImportBatch(
  batchId: string,
  userId: string
): Promise<{ deletedCount: number }> {
  const supabase = createClient();

  // Ambil semua ID transaksi yang masih aktif dalam batch ini
  const { data: rows, error: fetchErr } = await supabase
    .from('transactions')
    .select('id')
    .eq('import_batch_id', batchId)
    .is('deleted_at', null);

  if (fetchErr) throw new Error(fetchErr.message);

  const ids = (rows ?? []).map((r) => r.id as string);

  if (ids.length > 0) {
    // Soft delete batch (bulk update)
    const { error: updateErr } = await supabase
      .from('transactions')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .in('id', ids);

    if (updateErr) throw new Error(updateErr.message);
  }

  // Tandai batch sebagai rolled_back
  const { error: batchErr } = await supabase
    .from('import_batches')
    .update({
      status: 'rolled_back',
      rolled_back_at: new Date().toISOString(),
      rolled_back_by: userId,
    })
    .eq('id', batchId);

  if (batchErr) throw new Error(batchErr.message);

  return { deletedCount: ids.length };
}
