'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  History,
  Undo2,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import {
  getImportBatches,
  rollbackImportBatch,
  type ImportBatch,
  type ImportBatchStatus,
} from '@/lib/api/importBatches';
import { formatCurrency } from '@/lib/utils';

interface ImportBatchHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  userId: string;
  /** Dipanggil setelah rollback sukses — agar parent bisa refetch transaksi */
  onRollbackComplete?: () => void;
}

const STATUS_CONFIG: Record<
  ImportBatchStatus,
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  pending: {
    label: 'Sedang berjalan',
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    icon: Clock,
  },
  success: {
    label: 'Berhasil',
    color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    icon: CheckCircle2,
  },
  partial: {
    label: 'Sebagian gagal',
    color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    icon: AlertTriangle,
  },
  failed: {
    label: 'Gagal',
    color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    icon: XCircle,
  },
  rolled_back: {
    label: 'Dibatalkan',
    color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
    icon: RotateCcw,
  },
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImportBatchHistoryModal({
  isOpen,
  onClose,
  businessId,
  userId,
  onRollbackComplete,
}: ImportBatchHistoryModalProps) {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rollbackingId, setRollbackingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const fetchBatches = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getImportBatches(businessId, { limit: 50 });
      setBatches(data);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat riwayat import');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (isOpen) fetchBatches();
  }, [isOpen, fetchBatches]);

  const handleRollback = async (batchId: string) => {
    setRollbackingId(batchId);
    try {
      const { deletedCount } = await rollbackImportBatch(batchId, userId);
      alert(`Berhasil membatalkan ${deletedCount} transaksi.`);
      setConfirmingId(null);
      await fetchBatches();
      onRollbackComplete?.();
    } catch (err: any) {
      alert(err?.message || 'Gagal rollback batch');
    } finally {
      setRollbackingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <History className="h-6 w-6 text-indigo-500 dark:text-indigo-400" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Riwayat Import
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Daftar batch import transaksi beserta opsi pembatalan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-12 text-red-500 dark:text-red-400">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-70" />
              <p className="font-medium">{error}</p>
              <button
                onClick={fetchBatches}
                className="mt-3 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Coba lagi
              </button>
            </div>
          )}

          {!loading && !error && batches.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Belum ada riwayat import</p>
              <p className="text-sm mt-1">
                Upload file Excel/CSV akan otomatis tercatat di sini
              </p>
            </div>
          )}

          {!loading && !error && batches.length > 0 && (
            <div className="space-y-3">
              {batches.map((batch) => {
                const status = STATUS_CONFIG[batch.status];
                const StatusIcon = status.icon;
                const canRollback =
                  batch.status !== 'rolled_back' &&
                  batch.status !== 'pending' &&
                  batch.inserted_count > 0;
                const isRollbacking = rollbackingId === batch.id;
                const isConfirming = confirmingId === batch.id;

                return (
                  <div
                    key={batch.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* File info */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <FileSpreadsheet className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                              {batch.file_name}
                            </p>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}
                            >
                              <StatusIcon className="w-3 h-3" />
                              {status.label}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full">
                              {batch.import_mode === 'smart' ? 'Smart' : 'Manual'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                            <span>{formatDateTime(batch.imported_at)}</span>
                            <span>•</span>
                            <span>{formatFileSize(batch.file_size)}</span>
                            <span>•</span>
                            <span>
                              {batch.inserted_count}/{batch.total_rows} baris sukses
                            </span>
                            {batch.failed_count > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-red-500 dark:text-red-400">
                                  {batch.failed_count} gagal
                                </span>
                              </>
                            )}
                          </div>
                          {batch.importer?.full_name && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              oleh {batch.importer.full_name}
                            </p>
                          )}
                          {batch.rolled_back_at && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                              Dibatalkan pada {formatDateTime(batch.rolled_back_at)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Rollback action */}
                      {canRollback && !isConfirming && (
                        <button
                          onClick={() => setConfirmingId(batch.id)}
                          disabled={isRollbacking}
                          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                          title="Batalkan batch ini"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          Rollback
                        </button>
                      )}
                    </div>

                    {/* Confirmation inline */}
                    {isConfirming && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 bg-red-50 dark:bg-red-900/10 -mx-4 -mb-4 px-4 py-3 rounded-b-xl">
                        <p className="text-sm text-red-700 dark:text-red-300 mb-2">
                          Yakin ingin membatalkan batch ini?{' '}
                          <span className="font-semibold">
                            {batch.inserted_count} transaksi
                          </span>{' '}
                          akan dihapus (soft-delete).
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRollback(batch.id)}
                            disabled={isRollbacking}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                          >
                            {isRollbacking ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Memproses...
                              </>
                            ) : (
                              <>
                                <Undo2 className="w-3.5 h-3.5" />
                                Ya, rollback
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => setConfirmingId(null)}
                            disabled={isRollbacking}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Error details */}
                    {Array.isArray(batch.errors) && batch.errors.length > 0 && (
                      <details className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200">
                          Lihat {batch.errors.length} error
                        </summary>
                        <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                          {batch.errors.slice(0, 10).map((err, i) => (
                            <p
                              key={i}
                              className="text-xs text-red-600 dark:text-red-400 font-mono"
                            >
                              {err.row ? `[Baris ${err.row}] ` : ''}
                              {err.message}
                            </p>
                          ))}
                          {batch.errors.length > 10 && (
                            <p className="text-xs text-gray-500 italic">
                              ...dan {batch.errors.length - 10} error lainnya
                            </p>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
