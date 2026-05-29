'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { InvoiceForm } from './InvoiceForm';
import { useInvoiceFromTransactions } from '@/hooks/useInvoiceFromTransactions';
import { useBusinessContext } from '@/context/BusinessContext';
import { formatCurrency } from '@/lib/utils';
import { Receipt, ArrowRight } from 'lucide-react';
import type { Transaction, Invoice, InvoiceFormData } from '@/types';

interface CreateInvoiceFromTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The transactions chosen by the user. Must already be invoiceable. */
  transactions: Transaction[];
  onSuccess?: (invoice: Invoice) => void;
}

/**
 * Modal that opens InvoiceForm pre-filled with data from selected transactions.
 *
 * Shows a summary header (customer, count, total) so user knows what's about to
 * be invoiced, then renders InvoiceForm with prefillData for review/edit before
 * the final create.
 *
 * Validates customer-uniqueness before opening (handled by caller via
 * useInvoiceFromTransactions.buildPrefill — if invalid, returns null and toasts).
 */
export function CreateInvoiceFromTransactionsModal({
  isOpen,
  onClose,
  transactions,
  onSuccess,
}: CreateInvoiceFromTransactionsModalProps) {
  const { activeBusiness } = useBusinessContext();
  const { buildPrefill, createFromTransactions, saving, invoiceSettings } =
    useInvoiceFromTransactions();

  type PrefillResult = Awaited<ReturnType<typeof buildPrefill>>;
  const [prefillResult, setPrefillResult] = useState<PrefillResult>(null);

  // Build prefill async when modal opens so invoice_number is pre-fetched
  useEffect(() => {
    if (!isOpen || transactions.length === 0) {
      setPrefillResult(null);
      return;
    }
    let cancelled = false;
    buildPrefill(transactions).then((result) => {
      if (!cancelled) setPrefillResult(result);
    });
    return () => { cancelled = true; };
  }, [isOpen, transactions, buildPrefill]);

  const handleSubmit = async (data: InvoiceFormData) => {
    if (!prefillResult) return;
    const created = await createFromTransactions(
      data,
      prefillResult.transactionIds,
      prefillResult.linkedAmounts
    );
    if (created) {
      onClose();
      onSuccess?.(created);
    }
  };

  const summaryTotal = transactions.reduce((sum, t) => {
    return sum + (prefillResult?.linkedAmounts[t.id] ?? 0);
  }, 0);

  const customerName =
    transactions[0]?.contact?.name || transactions[0]?.name || '(tanpa nama)';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Buat Invoice dari Transaksi"
      size="2xl"
    >
      <div className="space-y-4 p-2">
        {/* Summary chip */}
        <div className="flex items-center gap-3 rounded-lg border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-900/10 px-4 py-3">
          <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
            <Receipt className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                {customerName}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="text-gray-600 dark:text-gray-400 flex-shrink-0">
                {transactions.length === 1
                  ? '1 transaksi'
                  : `${transactions.length} transaksi`}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Total tagihan:{' '}
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatCurrency(summaryTotal)}
              </span>
            </div>
          </div>
        </div>

        {prefillResult ? (
          <InvoiceForm
            onSubmit={handleSubmit}
            onCancel={onClose}
            loading={saving}
            prefillData={prefillResult.prefill}
            defaultInvoiceNumber={prefillResult.prefill.invoice_number}
            defaultDueDays={invoiceSettings?.default_due_days ?? 7}
            defaultTaxRate={invoiceSettings?.default_tax_rate ?? 11}
            defaultTaxType={invoiceSettings?.default_tax_type ?? 'none'}
            businessCategory={activeBusiness?.business_type}
          />
        ) : (
          <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
            Tidak ada transaksi valid yang bisa di-invoice.
          </div>
        )}
      </div>
    </Modal>
  );
}
