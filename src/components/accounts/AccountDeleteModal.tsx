'use client';

import type { Account } from '@/types';
import { AlertTriangle, Lock } from 'lucide-react';

interface AccountDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  account: Account | null;
}

export function AccountDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  account,
}: AccountDeleteModalProps) {
  if (!isOpen || !account) return null;

  const isSystemAccount = account.is_system;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          {/* Icon */}
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30">
            {isSystemAccount ? (
              <Lock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            )}
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-center text-gray-900 dark:text-gray-100 mb-2">
            {isSystemAccount ? 'Cannot Deactivate' : 'Deactivate Account?'}
          </h3>

          {/* Content */}
          {isSystemAccount ? (
            <div className="space-y-3 mb-6">
              <p className="text-center text-gray-600 dark:text-gray-400">
                System accounts cannot be deactivated as they are essential for the application to function properly.
              </p>
              <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Lock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {account.account_code} - {account.account_name}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">System Account</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              <p className="text-center text-gray-600 dark:text-gray-400">
                Are you sure you want to deactivate this account?
              </p>
              <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {account.account_code}
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {account.account_name}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Type: {account.account_type} | Balance: {account.normal_balance}
                </p>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                This account will be deactivated and hidden from dropdowns. It can be reactivated later if needed.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {isSystemAccount ? (
              <button
                onClick={onClose}
                className="btn-primary w-full"
                disabled={loading}
              >
                Understood
              </button>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="btn-secondary flex-1"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  className="flex-1 px-4 py-2 bg-red-600 dark:bg-red-700 text-white font-medium rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  {loading ? 'Deactivating...' : 'Deactivate'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
