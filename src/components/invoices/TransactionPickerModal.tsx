'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useBusinessContext } from '@/context/BusinessContext';
import { useInvoiceFromTransactions } from '@/hooks/useInvoiceFromTransactions';
import { getTransactions } from '@/lib/api/transactions';
import {
  isTradeReceivableTransaction,
  getOutstandingAmount,
  isSettled,
  isSettlementEntry,
} from '@/lib/accounting/guidance';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CheckSquare, Square, Receipt, Search, AlertCircle } from 'lucide-react';
import type { Transaction, Invoice } from '@/types';

interface TransactionPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when user proceeds to "Buat Invoice" with their selection. */
  onProceed: (transactions: Transaction[]) => void;
  /** Called after invoice successfully created (passes-through from upstream). */
  onSuccess?: (invoice: Invoice) => void;
}

/**
 * Modal that lets the user pick 1+ trade receivable transactions (outstanding,
 * not yet invoiced) — then proceed to the InvoiceForm flow.
 *
 * Filters:
 *   - Customer (auto-grouped — selecting customer shows only their transactions)
 *   - Search by description/name
 *
 * The modal does NOT create the invoice itself. It calls `onProceed(selected)`,
 * which the parent uses to open CreateInvoiceFromTransactionsModal.
 */
export function TransactionPickerModal({
  isOpen,
  onClose,
  onProceed,
}: TransactionPickerModalProps) {
  const { activeBusinessId: businessId } = useBusinessContext();
  const { linkedTransactionIds, loadingLinks } = useInvoiceFromTransactions();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customerFilter, setCustomerFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set());
      setCustomerFilter('');
      setSearch('');
    }
  }, [isOpen]);

  // Load transactions when modal opens
  useEffect(() => {
    if (!isOpen || !businessId) return;
    let cancelled = false;
    setLoading(true);
    getTransactions(businessId)
      .then((data) => {
        if (!cancelled) setTransactions(data);
      })
      .catch((err) => {
        console.error('Failed to load transactions:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, businessId]);

  // Filter to invoiceable (trade receivable, outstanding, not yet linked)
  const invoiceable = useMemo(() => {
    return transactions.filter((t) => {
      if (isSettlementEntry(t)) return false;
      if (isSettled(t)) return false;
      if (!isTradeReceivableTransaction(t)) return false;
      if (linkedTransactionIds.has(t.id)) return false;
      if (getOutstandingAmount(t) <= 0) return false;
      return true;
    });
  }, [transactions, linkedTransactionIds]);

  // Distinct customers (for the filter dropdown)
  const customers = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of invoiceable) {
      const key = t.contact_id || `name:${(t.name || '').trim().toLowerCase()}`;
      const label = t.contact?.name || t.name || '(tanpa nama)';
      if (!map.has(key)) map.set(key, label);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [invoiceable]);

  // Final filtered list
  const filtered = useMemo(() => {
    let list = invoiceable;
    if (customerFilter) {
      list = list.filter((t) => {
        const key = t.contact_id || `name:${(t.name || '').trim().toLowerCase()}`;
        return key === customerFilter;
      });
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          (t.name || '').toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [invoiceable, customerFilter, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedTransactions = useMemo(
    () => filtered.filter((t) => selectedIds.has(t.id)),
    [filtered, selectedIds]
  );

  const selectedTotal = selectedTransactions.reduce(
    (sum, t) => sum + getOutstandingAmount(t),
    0
  );

  // Auto-narrow customer filter: when user selects first transaction, lock
  // filter to its customer so they can't accidentally mix customers.
  useEffect(() => {
    if (selectedTransactions.length === 1 && !customerFilter) {
      const t = selectedTransactions[0];
      const key = t.contact_id || `name:${(t.name || '').trim().toLowerCase()}`;
      setCustomerFilter(key);
    }
    if (selectedTransactions.length === 0 && customerFilter) {
      // User unchecked everything — release the lock
      setCustomerFilter('');
    }
  }, [selectedTransactions, customerFilter]);

  const handleProceed = () => {
    if (selectedTransactions.length === 0) return;
    onProceed(selectedTransactions);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pilih Transaksi Piutang"
      size="2xl"
    >
      <div className="space-y-4 p-2">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / deskripsi..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            disabled={selectedTransactions.length > 0}
            className="sm:w-56 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            title={
              selectedTransactions.length > 0
                ? 'Customer dikunci selama ada transaksi yang dipilih'
                : undefined
            }
          >
            <option value="">Semua customer</option>
            {customers.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Lock notice */}
        {selectedTransactions.length > 0 && (
          <div className="flex items-start gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-900/40 rounded-lg text-xs text-indigo-700 dark:text-indigo-300">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              1 invoice = 1 customer. Filter dikunci untuk mencegah mencampur customer berbeda.
              Hapus semua centang untuk mengganti customer.
            </span>
          </div>
        )}

        {/* Transaction list */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-[420px] overflow-y-auto bg-gray-50 dark:bg-gray-800/50">
          {loading || loadingLinks ? (
            <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              Memuat transaksi...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              {invoiceable.length === 0
                ? 'Tidak ada transaksi piutang yang bisa di-invoice.'
                : 'Tidak ada transaksi yang cocok dengan filter.'}
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.map((t) => {
                const checked = selectedIds.has(t.id);
                const outstanding = getOutstandingAmount(t);
                const customerLabel = t.contact?.name || t.name || '(tanpa nama)';
                return (
                  <li
                    key={t.id}
                    onClick={() => toggleSelect(t.id)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      checked
                        ? 'bg-indigo-50 dark:bg-indigo-900/20'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700/60'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {checked ? (
                        <CheckSquare className="w-5 h-5 text-indigo-500" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {t.description || '(tanpa deskripsi)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <span>{customerLabel}</span>
                        <span>·</span>
                        <span>{formatDate(t.date)}</span>
                        <span>·</span>
                        <span className="font-mono">{t.debit_account?.account_code}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(outstanding)}
                      </div>
                      {outstanding < t.amount && (
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          sisa dari {formatCurrency(t.amount)}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedTransactions.length === 0 ? (
              <span>Belum ada transaksi dipilih</span>
            ) : (
              <span>
                <strong className="text-gray-900 dark:text-gray-100">
                  {selectedTransactions.length}
                </strong>{' '}
                terpilih · Total{' '}
                <strong className="text-gray-900 dark:text-gray-100">
                  {formatCurrency(selectedTotal)}
                </strong>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Batal
            </button>
            <button
              type="button"
              onClick={handleProceed}
              disabled={selectedTransactions.length === 0}
              className="btn-primary-glow flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Receipt className="w-4 h-4" />
              Buat Invoice
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
