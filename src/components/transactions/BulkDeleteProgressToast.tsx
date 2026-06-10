'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, Loader2, Trash2, X, XCircle } from 'lucide-react';
import type { BulkDeleteProgressState } from '@/hooks/useTransactions';

interface BulkDeleteProgressToastProps {
  progress: BulkDeleteProgressState | null;
  onDismiss: () => void;
}

export function BulkDeleteProgressToast({ progress, onDismiss }: BulkDeleteProgressToastProps) {
  useEffect(() => {
    if (!progress || progress.status === 'running') return;
    const timer = window.setTimeout(onDismiss, progress.status === 'completed' ? 5000 : 8000);
    return () => window.clearTimeout(timer);
  }, [onDismiss, progress]);

  const percentage = progress?.total
    ? Math.min(100, Math.round((progress.current / progress.total) * 100))
    : 0;

  return (
    <AnimatePresence>
      {progress && (
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          className="fixed bottom-24 right-4 z-[60] w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
            {progress.status === 'running' ? (
              <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-red-500" />
            ) : progress.status === 'error' || progress.failed > 0 ? (
              <XCircle className="h-5 w-5 flex-shrink-0 text-amber-500" />
            ) : (
              <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-500" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {progress.status === 'running'
                  ? 'Menghapus transaksi...'
                  : progress.status === 'error'
                    ? 'Bulk delete gagal'
                    : 'Bulk delete selesai'}
              </p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">{progress.message}</p>
            </div>
            {progress.status !== 'running' && (
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                aria-label="Tutup progress bulk delete"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="space-y-2 px-4 py-3">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                {progress.deleted} dihapus{progress.failed > 0 ? `, ${progress.failed} gagal` : ''}
              </span>
              <span>{progress.current}/{progress.total}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
              <motion.div
                className={`h-full rounded-full ${progress.failed > 0 ? 'bg-amber-500' : 'bg-red-500'}`}
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.25 }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
