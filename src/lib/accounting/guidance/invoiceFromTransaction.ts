/**
 * Invoice from Transaction (Buat Invoice dari Transaksi Piutang)
 *
 * Helper untuk fitur "create invoice from existing trade receivable transactions".
 * Pipeline: Transaction Piutang Usaha → Pick (1 atau N) → Generate Invoice.
 *
 * Aturan invoiceable:
 *   1. Transaksi adalah trade receivable (lewat isTradeReceivableTransaction)
 *   2. Transaksi belum di-link ke invoice lain (linkedInvoiceIds tidak include)
 *   3. Outstanding amount > 0 (belum fully settled)
 *
 * Catatan: Partial-settled transactions BOLEH di-invoice — line item invoice
 * pakai outstanding amount (sisa piutang), bukan original amount.
 */

import type { Transaction, Invoice, InvoiceFormData } from '@/types';
import {
  isTradeReceivableTransaction,
  isSettled,
  isSettlementEntry,
  getOutstandingAmount,
} from './receivableSettlement';

/**
 * Returns true if a transaction can be invoiced.
 *
 * @param transaction The candidate transaction
 * @param linkedTransactionIds Set of transaction IDs already linked to invoices
 */
export function isInvoiceable(
  transaction: Transaction,
  linkedTransactionIds: Set<string>
): boolean {
  if (isSettlementEntry(transaction)) return false;
  if (isSettled(transaction)) return false;
  if (!isTradeReceivableTransaction(transaction)) return false;
  if (linkedTransactionIds.has(transaction.id)) return false;
  if (getOutstandingAmount(transaction) <= 0) return false;
  return true;
}

/**
 * Validate that all transactions belong to the same customer.
 *
 * Customer identity priority:
 *   1. contact_id (if set)
 *   2. lower-cased trimmed `name` field
 *
 * Returns { ok: true } if all match, or { ok: false, error } with a
 * user-friendly Indonesian error message listing the distinct customers.
 */
export function validateSameCustomer(
  transactions: Transaction[]
): { ok: true } | { ok: false; error: string; customers: string[] } {
  if (transactions.length === 0) {
    return { ok: false, error: 'Pilih minimal 1 transaksi.', customers: [] };
  }

  const customerKey = (t: Transaction): string => {
    if (t.contact_id) return `id:${t.contact_id}`;
    return `name:${(t.name || '').trim().toLowerCase()}`;
  };

  const customerLabel = (t: Transaction): string => {
    return t.contact?.name || t.name || '(tanpa nama)';
  };

  const seen = new Map<string, string>();
  for (const t of transactions) {
    const key = customerKey(t);
    if (!seen.has(key)) {
      seen.set(key, customerLabel(t));
    }
  }

  if (seen.size > 1) {
    const customers = Array.from(seen.values());
    return {
      ok: false,
      error: `Tidak bisa gabungkan invoice dari customer berbeda: ${customers.join(', ')}.`,
      customers,
    };
  }

  return { ok: true };
}

interface BuildInvoicePrefillParams {
  transactions: Transaction[];
  defaultDueDays?: number;
  defaultTaxRate?: number;
  defaultTaxType?: Invoice['tax_type'];
  itemLabel?: string | null;
  /** Today's date in YYYY-MM-DD (override for tests) */
  today?: string;
}

/**
 * Build an InvoiceFormData prefill from selected transactions.
 *
 * Rules:
 *   - customer_name: dari transaksi pertama (caller harus sudah validateSameCustomer)
 *   - customer_phone: dari contact.phone kalau ada, else dari transaksi pertama
 *   - invoice_date: today
 *   - due_date: today + defaultDueDays (default 7)
 *   - line_items: 1 baris per transaksi
 *       - item_name: description || name || `Tagihan ${date}`
 *       - quantity & unit_price:
 *           * Bila transaksi punya meta.unit_breakdown DAN belum partial-settled
 *             (outstanding === amount), pakai qty × price_per_unit dari breakdown.
 *           * Bila partial-settled, fallback ke qty=1, unit_price=outstanding
 *             (tidak boleh tagih ulang porsi yang sudah dibayar).
 *   - tax_type: defaultTaxType ?? 'none'
 *   - description: kosong (user bisa edit)
 *
 * Caller bertanggung jawab generate invoice_number — biasanya di route
 * handler yang query last invoice_number dan increment.
 */
export function buildInvoicePrefill(params: BuildInvoicePrefillParams): InvoiceFormData {
  const {
    transactions,
    defaultDueDays = 7,
    defaultTaxRate = 0,
    defaultTaxType = 'none',
    itemLabel = null,
    today,
  } = params;

  const todayStr = today ?? new Date().toISOString().slice(0, 10);
  const dueDate = new Date(todayStr);
  dueDate.setDate(dueDate.getDate() + defaultDueDays);
  const dueDateStr = dueDate.toISOString().slice(0, 10);

  const first = transactions[0];
  const customerName = first?.contact?.name || first?.name || '';
  const customerPhone = first?.contact?.phone ?? '';

  const line_items = transactions.map((t) => {
    const itemName = t.description?.trim() || t.name?.trim() || `Tagihan ${t.date}`;
    const outstanding = getOutstandingAmount(t);
    const breakdown = t.meta?.unit_breakdown;

    // Pakai unit breakdown HANYA bila transaksi belum partial-settled.
    // Kalau partial-settled, qty × price akan menagih ulang porsi yang sudah dibayar.
    const isFullyOutstanding = outstanding === t.amount;
    if (
      breakdown &&
      isFullyOutstanding &&
      breakdown.quantity > 0 &&
      breakdown.price_per_unit > 0
    ) {
      return {
        item_name: itemName,
        quantity: breakdown.quantity,
        unit_price: breakdown.price_per_unit,
      };
    }

    return {
      item_name: itemName,
      quantity: 1,
      unit_price: outstanding,
    };
  });

  return {
    invoice_number: '', // diisi caller (route handler)
    invoice_date: todayStr,
    due_date: dueDateStr,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_id_label: '',
    description: '',
    item_label: itemLabel ?? '',
    line_items,
    tax_type: defaultTaxType,
    tax_rate: defaultTaxRate,
    notes: '',
  };
}

/**
 * Compute subtotal from prefill line_items.
 */
export function computeSubtotal(lineItems: InvoiceFormData['line_items']): number {
  return lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
}
