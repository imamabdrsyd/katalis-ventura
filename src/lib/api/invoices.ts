import { createClient } from '@/lib/supabase';
import type {
  Invoice,
  InvoiceFormData,
  InvoicePaymentStatus,
  InvoiceSettings,
  InvoiceTransactionLink,
} from '@/types';

// Roman numeral months for invoice number formatting
const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

// Calculate line item amount
function calculateLineItemAmount(quantity: number, unitPrice: number): number {
  return quantity * unitPrice;
}

// Calculate tax and totals from form data
function calculateInvoiceTotals(data: InvoiceFormData) {
  const subtotal = data.line_items.reduce(
    (sum, item) => sum + calculateLineItemAmount(item.quantity, item.unit_price),
    0
  );

  let taxAmount = 0;
  let totalAmount = subtotal;

  if (data.tax_type === 'excluded') {
    taxAmount = subtotal * (data.tax_rate / 100);
    totalAmount = subtotal + taxAmount;
  } else if (data.tax_type === 'included') {
    // Tax is already included in the subtotal
    taxAmount = subtotal - subtotal / (1 + data.tax_rate / 100);
    totalAmount = subtotal;
  }

  return { subtotal, taxAmount, totalAmount };
}

// Fetch all invoices for a business (with line items)
export async function getInvoices(businessId: string): Promise<Invoice[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      line_items:invoice_line_items(*)
    `)
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .order('invoice_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data as Invoice[];
}

// Fetch single invoice by ID (with line items)
export async function getInvoice(invoiceId: string): Promise<Invoice | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      line_items:invoice_line_items(*)
    `)
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(error.message);
  }
  return data as Invoice;
}

// Create invoice + line items
export async function createInvoice(
  businessId: string,
  userId: string,
  data: InvoiceFormData
): Promise<Invoice> {
  const supabase = createClient();
  const { subtotal, taxAmount, totalAmount } = calculateInvoiceTotals(data);

  // 1. Insert invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      business_id: businessId,
      invoice_number: data.invoice_number,
      invoice_date: data.invoice_date,
      due_date: data.due_date || null,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone || null,
      customer_id_label: data.customer_id_label || null,
      description: data.description || null,
      item_label: data.item_label || null,
      subtotal,
      tax_type: data.tax_type,
      tax_rate: data.tax_rate,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      payment_status: 'draft',
      notes: data.notes || null,
      created_by: userId,
    })
    .select()
    .single();

  if (invoiceError) throw new Error(invoiceError.message);

  // 2. Insert line items
  if (data.line_items.length > 0) {
    const lineItems = data.line_items.map((item, index) => ({
      invoice_id: invoice.id,
      item_name: item.item_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: calculateLineItemAmount(item.quantity, item.unit_price),
      sort_order: index,
    }));

    const { error: lineItemsError } = await supabase
      .from('invoice_line_items')
      .insert(lineItems);

    if (lineItemsError) throw new Error(lineItemsError.message);
  }

  // 3. Return created invoice with line items
  const created = await getInvoice(invoice.id);
  if (!created) throw new Error('Gagal mengambil invoice yang baru dibuat');
  return created;
}

// Update invoice + line items
export async function updateInvoice(
  invoiceId: string,
  userId: string,
  data: InvoiceFormData
): Promise<Invoice> {
  const supabase = createClient();
  const { subtotal, taxAmount, totalAmount } = calculateInvoiceTotals(data);

  // 1. Update invoice row
  const { error: invoiceError } = await supabase
    .from('invoices')
    .update({
      invoice_number: data.invoice_number,
      invoice_date: data.invoice_date,
      due_date: data.due_date || null,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone || null,
      customer_id_label: data.customer_id_label || null,
      description: data.description || null,
      item_label: data.item_label || null,
      subtotal,
      tax_type: data.tax_type,
      tax_rate: data.tax_rate,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      notes: data.notes || null,
      updated_by: userId,
    })
    .eq('id', invoiceId);

  if (invoiceError) throw new Error(invoiceError.message);

  // 2. Delete existing line items
  const { error: deleteError } = await supabase
    .from('invoice_line_items')
    .delete()
    .eq('invoice_id', invoiceId);

  if (deleteError) throw new Error(deleteError.message);

  // 3. Insert new line items
  if (data.line_items.length > 0) {
    const lineItems = data.line_items.map((item, index) => ({
      invoice_id: invoiceId,
      item_name: item.item_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: calculateLineItemAmount(item.quantity, item.unit_price),
      sort_order: index,
    }));

    const { error: lineItemsError } = await supabase
      .from('invoice_line_items')
      .insert(lineItems);

    if (lineItemsError) throw new Error(lineItemsError.message);
  }

  // 4. Return updated invoice with line items
  const updated = await getInvoice(invoiceId);
  if (!updated) throw new Error('Gagal mengambil invoice yang diupdate');
  return updated;
}

// Soft delete invoice
export async function deleteInvoice(invoiceId: string, userId: string): Promise<void> {
  const supabase = createClient();

  // Delete junction rows first so UNIQUE(transaction_id) is freed up,
  // allowing the same transactions to be invoiced again after deletion.
  // (Soft delete does not trigger ON DELETE CASCADE.)
  await supabase.from('invoice_transactions').delete().eq('invoice_id', invoiceId);

  const { error } = await supabase
    .from('invoices')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: userId,
    })
    .eq('id', invoiceId);

  if (error) throw new Error(error.message);
}

// Update payment status
export async function updateInvoiceStatus(
  invoiceId: string,
  status: InvoicePaymentStatus
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('invoices')
    .update({ payment_status: status })
    .eq('id', invoiceId);

  if (error) throw new Error(error.message);
}

// Get next invoice number for a business
// Format: {PREFIX}-{SEQ}/{ROMAN_MONTH}/{YEAR}
// Example: INV-001/III/2026
export async function getNextInvoiceNumber(
  businessId: string,
  prefix: string = 'INV'
): Promise<string> {
  const supabase = createClient();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const romanMonth = ROMAN_MONTHS[month];

  // Count invoices for this business in the current month/year
  const startOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endOfMonth = month === 11
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 2).padStart(2, '0')}-01`;

  const { count, error } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .gte('invoice_date', startOfMonth)
    .lt('invoice_date', endOfMonth);

  if (error) throw new Error(error.message);

  const seq = (count ?? 0) + 1;
  const paddedSeq = String(seq).padStart(3, '0');

  return `${prefix}-${paddedSeq}/${romanMonth}/${year}`;
}

// Get invoice settings for a business
export async function getInvoiceSettings(
  businessId: string
): Promise<InvoiceSettings | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('businesses')
    .select('invoice_settings')
    .eq('id', businessId)
    .single();

  if (error) throw new Error(error.message);
  return (data?.invoice_settings as InvoiceSettings) ?? null;
}

// Update invoice settings for a business
export async function updateInvoiceSettings(
  businessId: string,
  settings: InvoiceSettings
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('businesses')
    .update({ invoice_settings: settings })
    .eq('id', businessId);

  if (error) throw new Error(error.message);
}

// ─────────────────── Invoice ↔ Transaction Junction (Migration 086) ───────────────────

/**
 * Fetch all transaction IDs that are already linked to an invoice for this business.
 * Used by UI to render "Invoiced" badges and to filter invoiceable transactions.
 */
export async function getLinkedTransactionIds(businessId: string): Promise<Set<string>> {
  const supabase = createClient();

  // Subquery: invoices belonging to this business (RLS already scopes to user's businesses)
  const { data, error } = await supabase
    .from('invoice_transactions')
    .select('transaction_id, invoice:invoices!inner(business_id, deleted_at)')
    .eq('invoice.business_id', businessId)
    .is('invoice.deleted_at', null);

  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.transaction_id));
}

/**
 * Fetch transaction links for a specific invoice (used in invoice detail view).
 */
export async function getInvoiceTransactionLinks(
  invoiceId: string
): Promise<InvoiceTransactionLink[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('invoice_transactions')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as InvoiceTransactionLink[];
}

interface CreateInvoiceFromTransactionsInput {
  businessId: string;
  userId: string;
  transactionIds: string[];
  /** Invoice form data prefilled & potentially edited by user. */
  invoiceData: InvoiceFormData;
  /** Snapshot of outstanding amounts per transaction at link-time. */
  linkedAmounts: Record<string, number>;
}

/**
 * Create an invoice from N transactions atomically.
 *
 * Flow:
 *   1. Create invoice (status=unpaid since linked transactions are outstanding)
 *   2. Insert invoice_line_items
 *   3. Insert invoice_transactions junction rows
 *
 * If any step fails, callers should consider cleanup. We don't run inside a
 * single DB transaction here because supabase-js client doesn't support it
 * natively — for now, partial-failure is rare and recoverable by manual delete.
 *
 * Returns the created invoice with line_items + linked_transactions hydrated.
 */
export async function createInvoiceFromTransactions(
  input: CreateInvoiceFromTransactionsInput
): Promise<Invoice> {
  const supabase = createClient();
  const { businessId, userId, transactionIds, invoiceData, linkedAmounts } = input;

  if (transactionIds.length === 0) {
    throw new Error('Pilih minimal 1 transaksi untuk dijadikan invoice.');
  }

  const { subtotal, taxAmount, totalAmount } = calculateInvoiceTotals(invoiceData);

  // 1. Insert invoice — status 'unpaid' karena dibuat dari transaksi piutang outstanding
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      business_id: businessId,
      invoice_number: invoiceData.invoice_number,
      invoice_date: invoiceData.invoice_date,
      due_date: invoiceData.due_date || null,
      customer_name: invoiceData.customer_name,
      customer_phone: invoiceData.customer_phone || null,
      customer_id_label: invoiceData.customer_id_label || null,
      description: invoiceData.description || null,
      item_label: invoiceData.item_label || null,
      subtotal,
      tax_type: invoiceData.tax_type,
      tax_rate: invoiceData.tax_rate,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      payment_status: 'unpaid' as InvoicePaymentStatus,
      notes: invoiceData.notes || null,
      created_by: userId,
      meta: { generated_from_transactions: true, transaction_count: transactionIds.length },
    })
    .select()
    .single();

  if (invoiceError) throw new Error(invoiceError.message);

  // 2. Insert line items
  if (invoiceData.line_items.length > 0) {
    const lineItems = invoiceData.line_items.map((item, index) => ({
      invoice_id: invoice.id,
      item_name: item.item_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: calculateLineItemAmount(item.quantity, item.unit_price),
      sort_order: index,
    }));

    const { error: lineItemsError } = await supabase
      .from('invoice_line_items')
      .insert(lineItems);

    if (lineItemsError) {
      // Rollback: delete the invoice we just created
      await supabase.from('invoices').delete().eq('id', invoice.id);
      throw new Error(lineItemsError.message);
    }
  }

  // 3. Insert junction rows
  const junctionRows = transactionIds.map((txnId) => ({
    invoice_id: invoice.id,
    transaction_id: txnId,
    linked_amount: linkedAmounts[txnId] ?? 0,
    created_by: userId,
  }));

  const { error: junctionError } = await supabase
    .from('invoice_transactions')
    .insert(junctionRows);

  if (junctionError) {
    // Rollback: delete invoice (CASCADE removes line items)
    await supabase.from('invoices').delete().eq('id', invoice.id);
    // Special handling: unique constraint violation = transaksi sudah di-invoice
    if (junctionError.code === '23505') {
      throw new Error('Salah satu transaksi sudah pernah dijadikan invoice. Refresh halaman dan coba lagi.');
    }
    throw new Error(junctionError.message);
  }

  // 4. Return hydrated invoice
  const created = await getInvoice(invoice.id);
  if (!created) throw new Error('Gagal mengambil invoice yang baru dibuat');

  const links = await getInvoiceTransactionLinks(invoice.id);
  return { ...created, linked_transactions: links };
}
