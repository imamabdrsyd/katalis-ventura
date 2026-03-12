import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Invoice } from '@/types';
import { formatCurrency } from '@/lib/utils';

// Indigo accent color RGB
const INDIGO: [number, number, number] = [99, 102, 241];
const WHITE: [number, number, number] = [255, 255, 255];
const GRAY_TEXT: [number, number, number] = [107, 114, 128];
const BLACK: [number, number, number] = [17, 24, 39];

// Page dimensions (A4)
const PAGE_WIDTH = 210;
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const CONTENT_RIGHT = PAGE_WIDTH - MARGIN_RIGHT;

/**
 * Resolve the column header label for line items table.
 *
 * Priority:
 *   1. Custom `item_label` set on the invoice
 *   2. Business category mapping (jasa -> Layanan, produk -> Produk, dagang -> Barang)
 *   3. Fallback to 'Item'
 */
function resolveItemLabel(
  invoice: Invoice,
  businessCategory?: string | null
): string {
  if (invoice.item_label) return invoice.item_label;

  switch (businessCategory) {
    case 'jasa':
      return 'Layanan';
    case 'produk':
      return 'Produk';
    case 'dagang':
      return 'Barang';
    default:
      return 'Item';
  }
}

/**
 * Format a date string (YYYY-MM-DD or ISO) to DD/MM/YYYY.
 */
function formatDateDDMMYYYY(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Draw a horizontal accent line across the content area.
 */
function drawAccentLine(doc: jsPDF, y: number): void {
  doc.setDrawColor(...INDIGO);
  doc.setLineWidth(0.8);
  doc.line(MARGIN_LEFT, y, CONTENT_RIGHT, y);
}

/**
 * Export an invoice to a professionally styled PDF.
 *
 * Uses jsPDF + jspdf-autotable following the same patterns as the
 * existing financial report exports in `src/lib/export.ts`.
 */
export function exportInvoiceToPDF(params: {
  invoice: Invoice;
  business: {
    business_name: string;
    property_address?: string | null;
    business_category?: string | null;
    logo_url?: string | null;
  };
  paymentDetails?: {
    bank_name: string;
    bank_account_number: string;
    bank_account_holder: string;
    contact_number: string;
  } | null;
  issuerName?: string;
}): void {
  const { invoice, business, paymentDetails, issuerName } = params;
  const doc = new jsPDF();

  let cursorY = 20;

  // ─────────────────── HEADER ───────────────────

  // Business name (left, bold, large)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...BLACK);
  doc.text(business.business_name, MARGIN_LEFT, cursorY);

  // "INVOICE" title (right, bold, large)
  doc.setFontSize(24);
  doc.setTextColor(...INDIGO);
  doc.text('INVOICE', CONTENT_RIGHT, cursorY, { align: 'right' });

  cursorY += 7;

  // Business address (optional)
  if (business.property_address) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY_TEXT);

    // Split long addresses into multiple lines (max width ~90mm for left side)
    const addressLines = doc.splitTextToSize(business.property_address, 90);
    doc.text(addressLines, MARGIN_LEFT, cursorY);
    cursorY += addressLines.length * 4;
  }

  cursorY += 6;

  // ─────────────────── INVOICE META ───────────────────

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);

  doc.text(`Invoice No: ${invoice.invoice_number}`, MARGIN_LEFT, cursorY);
  cursorY += 5;

  // Customer ID label (optional)
  if (invoice.customer_id_label) {
    doc.text(`Customer ID: ${invoice.customer_id_label}`, MARGIN_LEFT, cursorY);
    cursorY += 5;
  }

  cursorY += 4;

  // ─────────────────── BILL TO + DATES ───────────────────

  const billToX = MARGIN_LEFT;
  const datesX = 140;

  // "BILL TO:" label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('BILL TO:', billToX, cursorY);

  // Date (right side)
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${formatDateDDMMYYYY(invoice.invoice_date)}`, datesX, cursorY);

  cursorY += 5;

  // Customer name
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.customer_name, billToX, cursorY);

  // Due date (right side, optional)
  if (invoice.due_date) {
    doc.text(`Due Date: ${formatDateDDMMYYYY(invoice.due_date)}`, datesX, cursorY);
  }

  cursorY += 5;

  // Customer phone (optional)
  if (invoice.customer_phone) {
    doc.setFontSize(9);
    doc.setTextColor(...GRAY_TEXT);
    doc.text(invoice.customer_phone, billToX, cursorY);
    cursorY += 5;
  }

  cursorY += 4;

  // ─────────────────── ACCENT LINE ───────────────────

  drawAccentLine(doc, cursorY);
  cursorY += 8;

  // ─────────────────── DESCRIPTION (optional) ───────────────────

  if (invoice.description) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...BLACK);
    doc.text('Description:', MARGIN_LEFT, cursorY);
    cursorY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY_TEXT);

    const descLines = doc.splitTextToSize(
      invoice.description,
      CONTENT_RIGHT - MARGIN_LEFT
    );
    doc.text(descLines, MARGIN_LEFT, cursorY);
    cursorY += descLines.length * 4 + 4;
  }

  // ─────────────────── LINE ITEMS TABLE ───────────────────

  const itemLabel = resolveItemLabel(invoice, business.business_category);
  const lineItems = invoice.line_items ?? [];

  const tableBody = lineItems.map((item) => [
    item.item_name,
    String(item.quantity),
    formatCurrency(item.unit_price),
    formatCurrency(item.amount),
  ]);

  autoTable(doc, {
    startY: cursorY,
    head: [[itemLabel, 'Qty', 'Price', 'Total']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: INDIGO,
      textColor: WHITE,
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'left',
    },
    styles: {
      fontSize: 9,
      textColor: BLACK,
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 45, halign: 'right' },
      3: { cellWidth: 45, halign: 'right' },
    },
    margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
  });

  cursorY = (doc as any).lastAutoTable.finalY + 10;

  // ─────────────────── PAYMENT DETAILS + TOTALS ───────────────────

  // Thin separator line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, cursorY, CONTENT_RIGHT, cursorY);
  cursorY += 8;

  const totalsX = 130;
  const totalsValueX = CONTENT_RIGHT;

  // Payment details (left side, optional)
  if (paymentDetails) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...BLACK);
    doc.text('Payment Details:', MARGIN_LEFT, cursorY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY_TEXT);

    const paymentStartY = cursorY + 5;
    doc.text(paymentDetails.bank_account_holder, MARGIN_LEFT, paymentStartY);
    doc.text(
      `${paymentDetails.bank_name}  ${paymentDetails.bank_account_number}`,
      MARGIN_LEFT,
      paymentStartY + 4.5
    );
    doc.text(
      `Contact: ${paymentDetails.contact_number}`,
      MARGIN_LEFT,
      paymentStartY + 9
    );
  }

  // Subtotal (right side)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text('Subtotal', totalsX, cursorY);
  doc.text(formatCurrency(invoice.subtotal), totalsValueX, cursorY, {
    align: 'right',
  });
  cursorY += 6;

  // Tax line (conditional)
  if (invoice.tax_type === 'included') {
    doc.setFontSize(9);
    doc.setTextColor(...GRAY_TEXT);
    doc.text('Value-Added Tax (included)', totalsX, cursorY);
    cursorY += 6;
  } else if (invoice.tax_type === 'excluded') {
    doc.setFontSize(9);
    doc.setTextColor(...GRAY_TEXT);
    doc.text('Value-Added Tax', totalsX, cursorY);
    doc.text(formatCurrency(invoice.tax_amount), totalsValueX, cursorY, {
      align: 'right',
    });
    cursorY += 6;
  }
  // tax_type === 'none' -> skip tax line entirely

  // Total (bold)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BLACK);
  doc.text('Total', totalsX, cursorY);
  doc.text(formatCurrency(invoice.total_amount), totalsValueX, cursorY, {
    align: 'right',
  });

  cursorY += 8;

  // ─────────────────── BOTTOM ACCENT LINE ───────────────────

  drawAccentLine(doc, cursorY);
  cursorY += 14;

  // ─────────────────── FOOTER: THANK YOU + SIGNATURE ───────────────────

  // Check if we need a new page for the footer section
  if (cursorY > 260) {
    doc.addPage();
    cursorY = 30;
  }

  // "Thank you for your business!" (left, indigo, bold)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INDIGO);
  doc.text('Thank you for', MARGIN_LEFT, cursorY);
  doc.text('your business!', MARGIN_LEFT, cursorY + 5);

  // Signature section (right side, optional)
  if (issuerName) {
    const sigLineX = 145;
    const sigLineEndX = CONTENT_RIGHT;
    const sigNameX = (sigLineX + sigLineEndX) / 2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY_TEXT);
    doc.text('Issued by:', sigNameX, cursorY - 4, { align: 'center' });

    // Signature line
    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.3);
    doc.line(sigLineX, cursorY + 6, sigLineEndX, cursorY + 6);

    // Issuer name below line
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...BLACK);
    doc.text(issuerName, sigNameX, cursorY + 11, { align: 'center' });
  }

  // ─────────────────── SAVE ───────────────────

  // Replace "/" with "-" in invoice number for safe file name
  const safeFileName = invoice.invoice_number.replace(/\//g, '-');
  doc.save(`${safeFileName}.pdf`);
}
