'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useBusinessContext } from '@/context/BusinessContext';
import { isManagerRole } from '@/lib/roles';
import * as invoicesApi from '@/lib/api/invoices';
import {
  isInvoiceable,
  validateSameCustomer,
  buildInvoicePrefill,
} from '@/lib/accounting/guidance/invoiceFromTransaction';
import { getOutstandingAmount } from '@/lib/accounting/guidance/receivableSettlement';
import type { Transaction, Invoice, InvoiceFormData, InvoiceSettings } from '@/types';

/**
 * Shared hook for the "Create Invoice from Transactions" feature.
 *
 * Provides:
 *   - linkedTransactionIds: set of transaction IDs already invoiced (for badge + filter)
 *   - invoiceSettings: per-business settings (prefix, due days, default tax)
 *   - canInvoiceTransactions(): pure check (returns error message or null)
 *   - createFromTransactions(): orchestrates validation + prefill + create
 *
 * Used by:
 *   - TransactionDetailModal (single-transaction button)
 *   - TransactionList bulk action
 *   - Invoices page picker modal
 */
export function useInvoiceFromTransactions() {
  const { user, activeBusinessId: businessId, userRole } = useBusinessContext();
  const canManage = isManagerRole(userRole);

  const [linkedTransactionIds, setLinkedTransactionIds] = useState<Set<string>>(new Set());
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingLinks, setLoadingLinks] = useState(true);

  // Refresh linked IDs + settings
  const refresh = useCallback(async () => {
    if (!businessId) return;
    setLoadingLinks(true);
    try {
      const [ids, settings] = await Promise.all([
        invoicesApi.getLinkedTransactionIds(businessId),
        invoicesApi.getInvoiceSettings(businessId),
      ]);
      setLinkedTransactionIds(ids);
      setInvoiceSettings(settings);
    } catch (err) {
      console.error('Failed to load invoice links:', err);
    } finally {
      setLoadingLinks(false);
    }
  }, [businessId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Pure validation — returns null if OK, or error message (Indonesian).
   * Caller should toast.error() the returned message.
   */
  const canInvoiceTransactions = useCallback(
    (transactions: Transaction[]): string | null => {
      if (!canManage) return 'Hanya business manager yang bisa membuat invoice.';
      if (transactions.length === 0) return 'Pilih minimal 1 transaksi.';

      for (const t of transactions) {
        if (!isInvoiceable(t, linkedTransactionIds)) {
          // Identify why this one failed
          if (linkedTransactionIds.has(t.id)) {
            return `Transaksi "${t.name || t.description}" sudah pernah dijadikan invoice.`;
          }
          if (getOutstandingAmount(t) <= 0) {
            return `Transaksi "${t.name || t.description}" sudah lunas.`;
          }
          return `Transaksi "${t.name || t.description}" bukan piutang usaha.`;
        }
      }

      const customerCheck = validateSameCustomer(transactions);
      if (!customerCheck.ok) return customerCheck.error;

      return null;
    },
    [canManage, linkedTransactionIds]
  );

  /**
   * Build the prefill data for opening InvoiceForm. Returns null if validation fails
   * (and toast'd the error already).
   */
  const buildPrefill = useCallback(
    async (transactions: Transaction[]): Promise<{
      prefill: InvoiceFormData;
      transactionIds: string[];
      linkedAmounts: Record<string, number>;
    } | null> => {
      const err = canInvoiceTransactions(transactions);
      if (err) {
        toast.error(err);
        return null;
      }

      // Fetch next invoice number upfront so the form shows it immediately
      let nextNumber = '';
      if (businessId) {
        try {
          const prefix = invoiceSettings?.prefix || 'INV';
          nextNumber = await invoicesApi.getNextInvoiceNumber(businessId, prefix);
        } catch {
          // Non-fatal — user can fill manually
        }
      }

      const prefill = buildInvoicePrefill({
        transactions,
        defaultDueDays: invoiceSettings?.default_due_days ?? 7,
        defaultTaxRate: invoiceSettings?.default_tax_rate ?? 0,
        defaultTaxType: invoiceSettings?.default_tax_type ?? 'none',
      });
      prefill.invoice_number = nextNumber;

      const linkedAmounts: Record<string, number> = {};
      for (const t of transactions) {
        linkedAmounts[t.id] = getOutstandingAmount(t);
      }

      return { prefill, transactionIds: transactions.map((t) => t.id), linkedAmounts };
    },
    [canInvoiceTransactions, invoiceSettings, businessId]
  );

  /**
   * Create the invoice. `invoiceData` should be the (potentially edited)
   * version of the prefill that user submitted from InvoiceForm.
   */
  const createFromTransactions = useCallback(
    async (
      invoiceData: InvoiceFormData,
      transactionIds: string[],
      linkedAmounts: Record<string, number>
    ): Promise<Invoice | null> => {
      if (!businessId || !user) return null;
      setSaving(true);
      try {
        // Generate invoice_number if empty
        if (!invoiceData.invoice_number) {
          const prefix = invoiceSettings?.prefix || 'INV';
          invoiceData = {
            ...invoiceData,
            invoice_number: await invoicesApi.getNextInvoiceNumber(businessId, prefix),
          };
        }

        const created = await invoicesApi.createInvoiceFromTransactions({
          businessId,
          userId: user.id,
          transactionIds,
          invoiceData,
          linkedAmounts,
        });

        toast.success(
          transactionIds.length === 1
            ? 'Invoice berhasil dibuat dari transaksi.'
            : `Invoice berhasil dibuat dari ${transactionIds.length} transaksi.`
        );

        // Refresh linked IDs so subsequent UI reflects the new link
        await refresh();

        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal membuat invoice.';
        toast.error(message);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [businessId, user, invoiceSettings, refresh]
  );

  /**
   * Filter a transaction list down to only those that are invoiceable.
   * Used by the picker modal in /invoices.
   */
  const filterInvoiceable = useCallback(
    (transactions: Transaction[]): Transaction[] => {
      return transactions.filter((t) => isInvoiceable(t, linkedTransactionIds));
    },
    [linkedTransactionIds]
  );

  return useMemo(
    () => ({
      linkedTransactionIds,
      invoiceSettings,
      saving,
      loadingLinks,
      canManage,
      canInvoiceTransactions,
      buildPrefill,
      createFromTransactions,
      filterInvoiceable,
      refresh,
    }),
    [
      linkedTransactionIds,
      invoiceSettings,
      saving,
      loadingLinks,
      canManage,
      canInvoiceTransactions,
      buildPrefill,
      createFromTransactions,
      filterInvoiceable,
      refresh,
    ]
  );
}
