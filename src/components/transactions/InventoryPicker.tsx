'use client';

import { useState } from 'react';
import type { Transaction } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Package, Check, ChevronDown, ChevronUp } from 'lucide-react';

interface InventoryPickerProps {
  stockTransactions: Transaction[];
  selectedIds: string[];
  onToggle: (transactionId: string) => void;
}

/**
 * InventoryPicker - Shows available stock transactions and lets user select
 * which inventory items were sold in this sale transaction.
 *
 * When an item is selected, the parent will convert that stock transaction
 * from inventory (debit=Inventory) to COGS (debit=COGS account).
 */
export function InventoryPicker({
  stockTransactions,
  selectedIds,
  onToggle,
}: InventoryPickerProps) {
  const [expanded, setExpanded] = useState(true);

  if (stockTransactions.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Persediaan yang Terjual
          </span>
          {selectedIds.length > 0 && (
            <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">
              {selectedIds.length} dipilih
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Pilih persediaan yang habis terjual. Persediaan yang dipilih akan otomatis dikonversi menjadi HPP (Harga Pokok Penjualan).
          </p>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {stockTransactions.map((tx) => {
              const isSelected = selectedIds.includes(tx.id);
              return (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => onToggle(tx.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-300 dark:border-indigo-600'
                      : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-700'
                  }`}
                >
                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                      isSelected
                        ? 'bg-indigo-500 dark:bg-indigo-500'
                        : 'border-2 border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {tx.name}
                      </span>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex-shrink-0">
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(tx.date)}
                      </span>
                      {tx.debit_account && (
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-mono">
                          {tx.debit_account.account_code} - {tx.debit_account.account_name}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
