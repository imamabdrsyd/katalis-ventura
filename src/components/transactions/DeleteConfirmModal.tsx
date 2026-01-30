'use client';

import { Modal } from '@/components/ui/Modal';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  transactionDescription: string;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  transactionDescription,
}: DeleteConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Hapus Transaksi">
      <div className="text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-red-600 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
          Apakah Anda yakin?
        </h3>
        <p className="text-gray-600 dark:text-gray-300 mb-2">
          Anda akan menghapus transaksi:
        </p>
        <p className="text-gray-800 dark:text-gray-100 font-medium mb-6 bg-gray-50 dark:bg-gray-700 px-4 py-2 rounded-lg">
          "{transactionDescription}"
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Tindakan ini tidak dapat dibatalkan.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
            disabled={loading}
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            className="btn-danger flex-1"
            disabled={loading}
          >
            {loading ? 'Menghapus...' : 'Ya, Hapus'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
