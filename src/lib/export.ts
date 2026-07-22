import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { FinancialSummary, BalanceSheetData, Transaction, SCEData } from '@/types';
import { formatCurrency, formatDate, formatDateWithDay } from './utils';
import { calculateIncomeStatementMetrics } from './calculations';
import type { IncomeStatementLineItems } from './calculations';
import type { TransactionAttachment } from '@/types';
import { resolveEmbeddableAttachmentUrl } from './storage/signedUrl';

// --- Income Statement PDF helpers ---

interface TransactionsByCategory {
  revenue: Transaction[];
  cogs: Transaction[];
  opex: Transaction[];
  tax: Transaction[];
  interest: Transaction[];
}

/** Group transactions by their relevant account name and sum amounts */
function groupByAccount(
  transactions: Transaction[],
  side: 'debit' | 'credit'
): { name: string; total: number }[] {
  const map = new Map<string, number>();
  for (const t of transactions) {
    const account = side === 'debit' ? t.debit_account : t.credit_account;
    const name = account?.account_name ?? t.description ?? 'Lainnya';
    map.set(name, (map.get(name) ?? 0) + t.amount);
  }
  return Array.from(map.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
}

// Row type markers for styling
type RowKind = 'section' | 'item' | 'subtotal' | 'blank' | 'total' | 'margin';

interface PDFRow {
  cells: [string, string];
  kind: RowKind;
}

/** Load an image, resize it using HTML5 Canvas, and return as a compressed JPEG data URL */
async function loadImageAsBase64(url: string, maxSize = 64): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();

    const originalDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image decode failed'));
      el.src = originalDataUrl;
    });

    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    return canvas.toDataURL('image/jpeg', 0.75);
  } catch {
    return null;
  }
}


// Export Income Statement to PDF — Xero-inspired layout with per-account breakdown
export async function exportIncomeStatementToPDF(
  businessName: string,
  period: string,
  summary: FinancialSummary,
  transactionsByCategory?: TransactionsByCategory,
  lineItems?: IncomeStatementLineItems
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const metrics = calculateIncomeStatementMetrics(summary);

  // ── Header ──
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('LAPORAN LABA RUGI', pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(99, 102, 241); // Indigo color
  doc.text(businessName, pageWidth / 2, 26, { align: 'center' });
  doc.setTextColor(0, 0, 0); // Reset color
  doc.setFont('helvetica', 'normal');

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Periode: ${period}`, pageWidth / 2, 33, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // ── Build rows ──
  const rows: PDFRow[] = [];

  const section = (label: string) => rows.push({ cells: [label, ''], kind: 'section' });
  const item = (label: string, amount: number, negate = false) =>
    rows.push({
      cells: [`    ${label}`, negate ? `(${formatCurrency(amount)})` : formatCurrency(amount)],
      kind: 'item',
    });
  const subtotal = (label: string, amount: number, negate = false) =>
    rows.push({
      cells: [label, negate ? `(${formatCurrency(amount)})` : formatCurrency(amount)],
      kind: 'subtotal',
    });
  const total = (label: string, amount: number) =>
    rows.push({ cells: [label, formatCurrency(amount)], kind: 'total' });
  const margin = (label: string, pct: number) =>
    rows.push({ cells: [`    ${label}`, `${pct.toFixed(2)}%`], kind: 'margin' });
  const blank = () => rows.push({ cells: ['', ''], kind: 'blank' });

  // Helper: render line items from the new lineItems structure, fallback to old groupByAccount
  const renderLineItems = (
    sectionItems: { accountCode: string; accountName: string; total: number }[] | undefined,
    fallbackTxs: Transaction[] | undefined,
    fallbackSide: 'debit' | 'credit',
    fallbackLabel: string,
    fallbackTotal: number

  ) => {
    if (sectionItems?.length) {
      for (const li of sectionItems) {
        const label = li.accountCode ? `${li.accountCode} – ${li.accountName}` : li.accountName;
        item(label, li.total);
      }
    } else if (fallbackTxs?.length) {
      const grouped = groupByAccount(fallbackTxs, fallbackSide);
      for (const g of grouped) item(g.name, g.total);
    } else if (fallbackTotal > 0) {
      item(fallbackLabel, fallbackTotal);
    }
  };

  // ── REVENUE ──
  section('PENDAPATAN');
  renderLineItems(lineItems?.revenue, transactionsByCategory?.revenue, 'credit', 'Pendapatan', summary.totalEarn);
  subtotal('TOTAL PENDAPATAN', summary.totalEarn);
  blank();

  // ── COST OF SALES ──
  section('HARGA POKOK PENJUALAN');
  renderLineItems(lineItems?.cogs, transactionsByCategory?.cogs, 'debit', 'Harga pokok penjualan', summary.totalVar);
  subtotal('TOTAL HARGA POKOK PENJUALAN', summary.totalVar, true);
  blank();

  // ── GROSS PROFIT ──
  total('LABA KOTOR', summary.grossProfit);
  if (summary.totalEarn > 0) margin('Margin kotor', metrics.grossMargin);
  blank();

  // ── OPERATING EXPENSES ──
  section('BEBAN USAHA');
  renderLineItems(lineItems?.opex, transactionsByCategory?.opex, 'debit', 'Beban operasional', summary.totalOpex);
  subtotal('TOTAL BEBAN USAHA', summary.totalOpex, true);
  blank();

  // ── DEPRECIATION (PSAK 16) ──
  if (summary.totalDepreciation > 0) {
    section('BEBAN PENYUSUTAN');
    item('Penyusutan aset tetap (straight-line)', summary.totalDepreciation);
    subtotal('TOTAL BEBAN PENYUSUTAN', summary.totalDepreciation, true);
    blank();
  }

  // ── OPERATING INCOME ──
  total('LABA USAHA', metrics.operatingIncome);
  if (summary.totalEarn > 0) margin('Margin usaha', metrics.operatingMargin);
  blank();

  // ── OTHER INCOME / FINANCING ──
  if (summary.totalInterest > 0) {
    section('BEBAN LAIN-LAIN');
    renderLineItems(lineItems?.interest, transactionsByCategory?.interest, 'debit', 'Beban bunga & pembiayaan', summary.totalInterest);
    subtotal('TOTAL BEBAN LAIN-LAIN', summary.totalInterest, true);
    blank();
  }

  // ── EBT ──
  total('LABA SEBELUM PAJAK', metrics.ebt);
  blank();

  // ── TAX ──
  if (summary.totalTax > 0) {
    section('PAJAK');
    renderLineItems(lineItems?.tax, transactionsByCategory?.tax, 'debit', 'Pajak', summary.totalTax);
    subtotal('TOTAL PAJAK', summary.totalTax, true);
    blank();
  }

  // ── NET INCOME ──
  total('LABA BERSIH', summary.netProfit);
  if (summary.totalEarn > 0) margin('Margin bersih', metrics.netMargin);

  // ── Render table ──
  const tableBody = rows.map((r) => r.cells);

  autoTable(doc, {
    startY: 40,
    head: [['Keterangan', 'Jumlah (Rp)']],
    body: tableBody,
    theme: 'plain',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [60, 60, 60],
      fontSize: 9,
      fontStyle: 'bold',
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
    },
    styles: {
      fontSize: 9,
      cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 },
      lineColor: [220, 220, 220],
      lineWidth: 0,
      textColor: [40, 40, 40],
    },
    columnStyles: {
      0: { cellWidth: 125 },
      1: { cellWidth: 55, halign: 'right' },
    },
    didParseCell: function (data) {
      if (data.section !== 'body') return;
      const row = rows[data.row.index];
      if (!row) return;

      switch (row.kind) {
        case 'section':
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 9.5;
          data.cell.styles.textColor = [30, 30, 30];
          break;
        case 'item':
          data.cell.styles.textColor = [80, 80, 80];
          break;
        case 'subtotal':
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 9;
          break;
        case 'total':
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 10;
          data.cell.styles.fillColor = [245, 245, 245];
          break;
        case 'margin':
          data.cell.styles.fontStyle = 'italic';
          data.cell.styles.textColor = [120, 120, 120];
          data.cell.styles.fontSize = 8;
          break;
        case 'blank':
          data.cell.styles.minCellHeight = 3;
          break;
      }
    },
    didDrawCell: function (data) {
      if (data.section !== 'body') return;
      const row = rows[data.row.index];
      if (!row) return;

      // Draw top border line for section headers & totals
      if (row.kind === 'section' || row.kind === 'total') {
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y);
      }

      // Draw bottom border for subtotals & totals
      if (row.kind === 'subtotal' || row.kind === 'total') {
        const bottomY = data.cell.y + data.cell.height;
        doc.setDrawColor(row.kind === 'total' ? 80 : 180, row.kind === 'total' ? 80 : 180, row.kind === 'total' ? 80 : 180);
        doc.setLineWidth(row.kind === 'total' ? 0.5 : 0.3);
        doc.line(data.cell.x, bottomY, data.cell.x + data.cell.width, bottomY);
      }
    },
  });

  // ── Footer with AXION logo ──
  const faviconBase64 = await loadImageAsBase64('/images/favicon.png');
  const pageCount = (doc as any).internal.getNumberOfPages();
  const footerY = 284;
  const logoSize = 5;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Left: "Dicetak oleh AXION pada [Date]"
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Dicetak oleh AXION pada ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      14,
      footerY + 1
    );

    // Right: page number
    doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - 14, footerY + 1, { align: 'right' });

    // Center: favicon logo
    if (faviconBase64) {
      doc.addImage(faviconBase64, 'JPEG', (pageWidth - logoSize) / 2, footerY - 3, logoSize, logoSize);
    }
  }
  doc.setTextColor(0, 0, 0);

  // Save
  doc.save(`Laporan-Laba-Rugi-${businessName}-${period}.pdf`);
}

// Export Income Statement to Excel
export function exportIncomeStatementToExcel(
  businessName: string,
  period: string,
  summary: FinancialSummary
) {
  // Use consolidated calculation
  const metrics = calculateIncomeStatementMetrics(summary);

  // Create worksheet data
  const data = [
    ['INCOME STATEMENT'],
    [businessName],
    [`Period: ${period}`],
    [],
    ['Description', 'Amount'],
    ['REVENUE', ''],
    ['Total Revenue', summary.totalEarn],
    [],
    ['COST OF GOODS SOLD', ''],
    ['Variable Costs', -summary.totalVar],
    [],
    ['GROSS PROFIT', summary.grossProfit],
    ['Gross Margin (%)', metrics.grossMargin],
    [],
    ['OPERATING EXPENSES', ''],
    ['Operating Expenses', -summary.totalOpex],
    ...(summary.totalDepreciation > 0
      ? [[], ['BEBAN PENYUSUTAN', ''], ['Depreciation Expense', -summary.totalDepreciation]]
      : []),
    [],
    ['OPERATING INCOME', metrics.operatingIncome],
    ['Operating Margin (%)', metrics.operatingMargin],
    [],
    ['FINANCING COSTS', ''],
    ['Interest & Financing', -summary.totalInterest],
    [],
    ['EARNINGS BEFORE TAX (EBT)', metrics.ebt],
    [],
    ['TAX', ''],
    ['Tax', -summary.totalTax],
    [],
    ['NET INCOME', summary.netProfit],
    ['Net Margin (%)', metrics.netMargin],
    [],
    [],
    [`Generated on ${new Date().toLocaleDateString('id-ID')}`],
  ];

  // Create workbook and worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = [{ wch: 30 }, { wch: 20 }];

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Income Statement');

  // Save file
  XLSX.writeFile(wb, `Income-Statement-${businessName}-${period}.xlsx`);
}

// Export Cash Flow Statement to PDF
export async function exportCashFlowToPDF(
  businessName: string,
  period: string,
  data: {
    operating: number;
    investing: number;
    financing: number;
    netCashFlow: number;
    openingBalance: number;
    closingBalance: number;
  }
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // ── Header ──
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('LAPORAN ARUS KAS', pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(99, 102, 241); // Indigo color
  doc.text(businessName, pageWidth / 2, 26, { align: 'center' });
  doc.setTextColor(0, 0, 0); // Reset color
  doc.setFont('helvetica', 'normal');

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Periode: ${period}`, pageWidth / 2, 33, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // ── Build rows ──
  const rows: PDFRow[] = [];

  const section = (label: string) => rows.push({ cells: [label, ''], kind: 'section' });
  const item = (label: string, amount: number) =>
    rows.push({
      cells: [`    ${label}`, formatCurrency(amount)],
      kind: 'item',
    });
  const subtotal = (label: string, amount: number) =>
    rows.push({
      cells: [label, formatCurrency(amount)],
      kind: 'subtotal',
    });
  const total = (label: string, amount: number) =>
    rows.push({ cells: [label, formatCurrency(amount)], kind: 'total' });
  const blank = () => rows.push({ cells: ['', ''], kind: 'blank' });

  // ── OPENING BALANCE ──
  total('SALDO AWAL', data.openingBalance);
  blank();

  // ── OPERATING ACTIVITIES ──
  section('ARUS KAS OPERASIONAL');
  item('Kas dari operasi', data.operating);
  subtotal('TOTAL ARUS KAS OPERASIONAL', data.operating);
  blank();

  // ── INVESTING ACTIVITIES ──
  section('ARUS KAS INVESTASI');
  item('Belanja modal', data.investing);
  subtotal('TOTAL ARUS KAS INVESTASI', data.investing);
  blank();

  // ── FINANCING ACTIVITIES ──
  section('ARUS KAS PEMBIAYAAN');
  item('Kas dari pembiayaan', data.financing);
  subtotal('TOTAL ARUS KAS PEMBIAYAAN', data.financing);
  blank();

  // ── NET CASH FLOW ──
  total('PERUBAHAN BERSIH KAS', data.netCashFlow);
  blank();

  // ── CLOSING BALANCE ──
  total('SALDO AKHIR', data.closingBalance);

  // ── Render table ──
  const tableBody = rows.map((r) => r.cells);

  autoTable(doc, {
    startY: 40,
    head: [['Keterangan', 'Jumlah (Rp)']],
    body: tableBody,
    theme: 'plain',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [60, 60, 60],
      fontSize: 9,
      fontStyle: 'bold',
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
    },
    styles: {
      fontSize: 9,
      cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 },
      lineColor: [220, 220, 220],
      lineWidth: 0,
      textColor: [40, 40, 40],
    },
    columnStyles: {
      0: { cellWidth: 125 },
      1: { cellWidth: 55, halign: 'right' },
    },
    didParseCell: function (data) {
      if (data.section !== 'body') return;
      const row = rows[data.row.index];
      if (!row) return;

      switch (row.kind) {
        case 'section':
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 9.5;
          data.cell.styles.textColor = [30, 30, 30];
          break;
        case 'item':
          data.cell.styles.textColor = [80, 80, 80];
          break;
        case 'subtotal':
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 9;
          break;
        case 'total':
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 10;
          data.cell.styles.fillColor = [245, 245, 245];
          break;
        case 'blank':
          data.cell.styles.minCellHeight = 3;
          break;
      }
    },
    didDrawCell: function (data) {
      if (data.section !== 'body') return;
      const row = rows[data.row.index];
      if (!row) return;

      // Draw top border line for section headers & totals
      if (row.kind === 'section' || row.kind === 'total') {
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y);
      }

      // Draw bottom border for subtotals & totals
      if (row.kind === 'subtotal' || row.kind === 'total') {
        const bottomY = data.cell.y + data.cell.height;
        doc.setDrawColor(row.kind === 'total' ? 80 : 180, row.kind === 'total' ? 80 : 180, row.kind === 'total' ? 80 : 180);
        doc.setLineWidth(row.kind === 'total' ? 0.5 : 0.3);
        doc.line(data.cell.x, bottomY, data.cell.x + data.cell.width, bottomY);
      }
    },
  });

  // ── Footer with AXION logo ──
  const faviconBase64 = await loadImageAsBase64('/images/favicon.png');
  const pageCount = (doc as any).internal.getNumberOfPages();
  const footerY = 284;
  const logoSize = 5;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Left: "Dicetak oleh AXION pada [Date]"
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Dicetak oleh AXION pada ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      14,
      footerY + 1
    );

    // Right: page number
    doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - 14, footerY + 1, { align: 'right' });

    // Center: favicon logo
    if (faviconBase64) {
      doc.addImage(faviconBase64, 'JPEG', (pageWidth - logoSize) / 2, footerY - 3, logoSize, logoSize);
    }
  }
  doc.setTextColor(0, 0, 0);

  // Save
  doc.save(`Laporan-Arus-Kas-${businessName}-${period}.pdf`);
}

// Export Cash Flow Statement to Excel
export function exportCashFlowToExcel(
  businessName: string,
  period: string,
  data: {
    operating: number;
    investing: number;
    financing: number;
    netCashFlow: number;
    openingBalance: number;
    closingBalance: number;
  }
) {
  // Create worksheet data
  const excelData = [
    ['CASH FLOW STATEMENT'],
    [businessName],
    [`Period: ${period}`],
    [],
    ['Description', 'Amount'],
    ['Opening Balance', data.openingBalance],
    [],
    ['OPERATING ACTIVITIES', ''],
    ['Cash from Operations', data.operating],
    [],
    ['INVESTING ACTIVITIES', ''],
    ['Capital Expenditure', data.investing],
    [],
    ['FINANCING ACTIVITIES', ''],
    ['Financing Cash Flow', data.financing],
    [],
    ['NET CASH FLOW', data.netCashFlow],
    [],
    ['CLOSING BALANCE', data.closingBalance],
    [],
    [],
    [`Generated on ${new Date().toLocaleDateString('id-ID')}`],
  ];

  // Create workbook and worksheet
  const ws = XLSX.utils.aoa_to_sheet(excelData);

  // Set column widths
  ws['!cols'] = [{ wch: 30 }, { wch: 20 }];

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cash Flow');

  // Save file
  XLSX.writeFile(wb, `Cash-Flow-${businessName}-${period}.xlsx`);
}

// Export selected transactions list to PDF (bulk-select feature)
export async function exportSelectedTransactionsToPDF(
  businessName: string,
  title: string,
  subtitle: string | undefined,
  transactions: Transaction[]
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // ── Header ──
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, 18, { align: 'center' });

  let cursorY = 24;
  if (subtitle && subtitle.trim()) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(subtitle, pageWidth / 2, cursorY, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    cursorY += 6;
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(99, 102, 241);
  doc.text(businessName, pageWidth / 2, cursorY, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  cursorY += 5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(`Total transaksi: ${transactions.length}`, pageWidth / 2, cursorY, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // ── Table rows ──
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const body = sorted.map((tr, idx) => {
    const qty = tr.meta?.unit_breakdown?.quantity;
    const unit = tr.meta?.unit_breakdown?.unit;
    return [
      String(idx + 1),
      tr.description ?? tr.name ?? '-',
      qty !== undefined ? String(qty) : '-',
      unit ?? '-',
      new Date(tr.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
      formatCurrency(tr.amount),
    ];
  });

  const totalAmount = sorted.reduce((sum, tr) => sum + tr.amount, 0);

  autoTable(doc, {
    startY: cursorY + 6,
    head: [['No.', 'Deskripsi', 'Qty', 'Satuan', 'Tanggal', 'Jumlah (Rp)']],
    body,
    foot: [['', '', '', '', 'Total', formatCurrency(totalAmount)]],
    theme: 'plain',
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [40, 40, 40],
      fontSize: 9,
      fontStyle: 'bold',
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
    },
    footStyles: {
      fillColor: [245, 245, 245],
      textColor: [40, 40, 40],
      fontSize: 9.5,
      fontStyle: 'bold',
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
    },
    styles: {
      fontSize: 9,
      cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 },
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
      textColor: [40, 40, 40],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'right' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 28 },
      5: { cellWidth: 35, halign: 'right' },
    },
  });

  // ── Footer with AXION logo ──
  const faviconBase64 = await loadImageAsBase64('/images/favicon.png');
  const pageCount = (doc as any).internal.getNumberOfPages();
  const footerY = 284;
  const logoSize = 5;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Dicetak oleh AXION pada ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      14,
      footerY + 1
    );

    doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - 14, footerY + 1, { align: 'right' });

    if (faviconBase64) {
      doc.addImage(faviconBase64, 'JPEG', (pageWidth - logoSize) / 2, footerY - 3, logoSize, logoSize);
    }
  }
  doc.setTextColor(0, 0, 0);

  const safeTitle = title.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-') || 'Transaksi';
  doc.save(`${safeTitle}-${businessName}.pdf`);
}

// Export Balance Sheet to PDF
export async function exportBalanceSheetToPDF(
  businessName: string,
  asOfDate: string,
  data: BalanceSheetData
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // ── Header ──
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('NERACA', pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(99, 102, 241); // Indigo color
  doc.text(businessName, pageWidth / 2, 26, { align: 'center' });
  doc.setTextColor(0, 0, 0); // Reset color

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text(`Per: ${asOfDate}`, pageWidth / 2, 33, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // Check if balanced
  const isBalanced = Math.abs(
    data.assets.totalAssets - (data.liabilities.totalLiabilities + data.equity.totalEquity)
  ) < 0.01;

  // ── Build rows ──
  const rows: PDFRow[] = [];

  const section = (label: string) => rows.push({ cells: [label, ''], kind: 'section' });
  const item = (label: string, amount: number) =>
    rows.push({
      cells: [`    ${label}`, formatCurrency(amount)],
      kind: 'item',
    });
  const subtotal = (label: string, amount: number) =>
    rows.push({
      cells: [label, formatCurrency(amount)],
      kind: 'subtotal',
    });
  const total = (label: string, amount: number) =>
    rows.push({ cells: [label, formatCurrency(amount)], kind: 'total' });
  const blank = () => rows.push({ cells: ['', ''], kind: 'blank' });

  // ── ASSETS ──
  section('ASET');
  section('Aset Lancar');
  item('Kas & Bank', data.assets.cash);
  if (data.assets.inventory !== 0) {
    item('Persediaan', data.assets.inventory);
  }
  if (data.assets.receivables !== 0) {
    item('Piutang', data.assets.receivables);
  }
  if (data.assets.otherCurrentAssets !== 0) {
    item('Aset Lancar Lainnya', data.assets.otherCurrentAssets);
  }
  subtotal('TOTAL ASET LANCAR', data.assets.totalCurrentAssets);
  blank();

  section('Aset Tetap');
  item('Nilai Perolehan', data.assets.fixedAssets);
  if (data.assets.accumulatedDepreciation > 0) {
    item('Akumulasi Penyusutan', data.assets.accumulatedDepreciation);
  }
  subtotal(
    data.assets.accumulatedDepreciation > 0 ? 'Nilai Buku Aset Tetap' : 'TOTAL ASET TETAP',
    data.assets.totalFixedAssets
  );
  blank();

  total('TOTAL ASET', data.assets.totalAssets);
  blank();

  // ── LIABILITIES & EQUITY ──
  section('LIABILITAS');
  item('Hutang', data.liabilities.loans);
  subtotal('TOTAL LIABILITAS', data.liabilities.totalLiabilities);
  blank();

  section('EKUITAS');
  item('Modal Disetor', data.equity.capital);
  item('Laba Ditahan', data.equity.retainedEarnings);
  subtotal('TOTAL EKUITAS', data.equity.totalEquity);
  blank();

  total(
    'TOTAL LIABILITAS & EKUITAS',
    data.liabilities.totalLiabilities + data.equity.totalEquity
  );
  blank();

  // Balance status
  rows.push({
    cells: [
      isBalanced ? '✓ Seimbang' : '⚠ Tidak Seimbang',
      isBalanced ? 'Aset = Liabilitas + Ekuitas' : 'Aset ≠ Liabilitas + Ekuitas',
    ],
    kind: 'item',
  });

  // ── Render table ──
  const tableBody = rows.map((r) => r.cells);

  autoTable(doc, {
    startY: 40,
    head: [['Keterangan', 'Jumlah (Rp)']],
    body: tableBody,
    theme: 'plain',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [60, 60, 60],
      fontSize: 9,
      fontStyle: 'bold',
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
    },
    styles: {
      fontSize: 9,
      cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 },
      lineColor: [220, 220, 220],
      lineWidth: 0,
      textColor: [40, 40, 40],
    },
    columnStyles: {
      0: { cellWidth: 125 },
      1: { cellWidth: 55, halign: 'right' },
    },
    didParseCell: function (data) {
      if (data.section !== 'body') return;
      const row = rows[data.row.index];
      if (!row) return;

      switch (row.kind) {
        case 'section':
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 9.5;
          data.cell.styles.textColor = [30, 30, 30];
          break;
        case 'item':
          data.cell.styles.textColor = [80, 80, 80];
          break;
        case 'subtotal':
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 9;
          break;
        case 'total':
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 10;
          data.cell.styles.fillColor = [245, 245, 245];
          break;
        case 'blank':
          data.cell.styles.minCellHeight = 3;
          break;
      }
    },
    didDrawCell: function (data) {
      if (data.section !== 'body') return;
      const row = rows[data.row.index];
      if (!row) return;

      // Draw top border line for section headers & totals
      if (row.kind === 'section' || row.kind === 'total') {
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y);
      }

      // Draw bottom border for subtotals & totals
      if (row.kind === 'subtotal' || row.kind === 'total') {
        const bottomY = data.cell.y + data.cell.height;
        doc.setDrawColor(row.kind === 'total' ? 80 : 180, row.kind === 'total' ? 80 : 180, row.kind === 'total' ? 80 : 180);
        doc.setLineWidth(row.kind === 'total' ? 0.5 : 0.3);
        doc.line(data.cell.x, bottomY, data.cell.x + data.cell.width, bottomY);
      }
    },
  });

  // ── Footer with AXION logo ──
  const faviconBase64 = await loadImageAsBase64('/images/favicon.png');
  const pageCount = (doc as any).internal.getNumberOfPages();
  const footerY = 284;
  const logoSize = 5;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Left: "Dicetak oleh AXION pada [Date]"
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Dicetak oleh AXION pada ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      14,
      footerY + 1
    );

    // Right: page number
    doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - 14, footerY + 1, { align: 'right' });

    // Center: favicon logo
    if (faviconBase64) {
      doc.addImage(faviconBase64, 'JPEG', (pageWidth - logoSize) / 2, footerY - 3, logoSize, logoSize);
    }
  }
  doc.setTextColor(0, 0, 0);

  // Save
  doc.save(`Neraca-${businessName}-${asOfDate}.pdf`);
}

// Export Balance Sheet to Excel
export function exportBalanceSheetToExcel(
  businessName: string,
  asOfDate: string,
  data: BalanceSheetData
) {
  // Check if balanced
  const isBalanced = Math.abs(
    data.assets.totalAssets - (data.liabilities.totalLiabilities + data.equity.totalEquity)
  ) < 0.01;

  // Prepare Excel data
  const excelData = [
    ['BALANCE SHEET'],
    [businessName],
    [`As of: ${asOfDate}`],
    [],
    ['ASSETS', 'Amount'],
    [],
    ['Current Assets', ''],
    ['Cash & Bank', data.assets.cash],
    ...(data.assets.inventory !== 0 ? [['Inventory', data.assets.inventory]] : []),
    ...(data.assets.receivables !== 0 ? [['Receivables', data.assets.receivables]] : []),
    ...(data.assets.otherCurrentAssets !== 0 ? [['Other Current Assets', data.assets.otherCurrentAssets]] : []),
    ['Total Current Assets', data.assets.totalCurrentAssets],
    [],
    ['Fixed Assets', ''],
    ['Nilai Perolehan', data.assets.fixedAssets],
    ...(data.assets.accumulatedDepreciation > 0
      ? [['Akumulasi Penyusutan', -data.assets.accumulatedDepreciation]]
      : []),
    [data.assets.accumulatedDepreciation > 0 ? 'Nilai Buku Aset Tetap' : 'Total Fixed Assets', data.assets.totalFixedAssets],
    [],
    ['TOTAL ASSETS', data.assets.totalAssets],
    [],
    [],
    ['LIABILITIES & EQUITY', 'Amount'],
    [],
    ['Liabilities', ''],
    ['Loans', data.liabilities.loans],
    ['Total Liabilities', data.liabilities.totalLiabilities],
    [],
    ['Equity', ''],
    ['Modal Disetor', data.equity.capital],
    ['Retained Earnings', data.equity.retainedEarnings],
    ['Total Equity', data.equity.totalEquity],
    [],
    ['TOTAL LIABILITIES & EQUITY', data.liabilities.totalLiabilities + data.equity.totalEquity],
    [],
    [],
    [
      isBalanced ? '✓ Balanced' : '⚠ Not Balanced',
      isBalanced ? 'Assets = Liabilities + Equity' : 'Assets ≠ Liabilities + Equity',
    ],
    [],
    [],
    [`Generated on ${new Date().toLocaleDateString('id-ID')}`],
  ];

  // Create workbook and worksheet
  const ws = XLSX.utils.aoa_to_sheet(excelData);

  // Set column widths
  ws['!cols'] = [{ wch: 30 }, { wch: 20 }];

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Balance Sheet');

  // Save file
  XLSX.writeFile(wb, `Balance-Sheet-${businessName}-${asOfDate}.xlsx`);
}

// ==================== STATEMENT OF CHANGES IN EQUITY ====================

const ownerLabel = (o: { contactName: string | null; ownerName: string }) =>
  o.contactName ?? o.ownerName;

// Export Statement of Changes in Equity to PDF
export async function exportSCEToPDF(
  businessName: string,
  period: string,
  data: SCEData
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // ── Header ──
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('LAPORAN PERUBAHAN EKUITAS', pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(99, 102, 241);
  doc.text(businessName, pageWidth / 2, 26, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text(`Periode: ${period}`, pageWidth / 2, 33, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // ── Tabel 1: Perubahan Ekuitas (Saldo Awal → Mutasi → Saldo Akhir) ──
  const sceHead = [['Komponen', 'Saldo Awal', 'Penambahan', 'Pengurangan', 'Saldo Akhir']];
  const sceBody: (string | number)[][] = [];

  // Modal per pemilik
  for (const o of data.owners) {
    sceBody.push([
      `Modal — ${ownerLabel(o)}`,
      formatCurrency(o.capitalOpening),
      formatCurrency(o.capitalAdditions),
      o.capitalWithdrawals ? `(${formatCurrency(o.capitalWithdrawals)})` : '-',
      formatCurrency(o.capitalClosing),
    ]);
  }

  // Laba ditahan
  sceBody.push([
    'Laba Ditahan',
    formatCurrency(data.retainedOpening),
    data.netIncome >= 0 ? formatCurrency(data.netIncome) : '-',
    data.netIncome < 0
      ? `(${formatCurrency(Math.abs(data.netIncome))})`
      : data.dividendsDeclared
        ? `(${formatCurrency(data.dividendsDeclared)})`
        : '-',
    formatCurrency(data.retainedClosing),
  ]);

  // Total
  sceBody.push([
    'TOTAL EKUITAS',
    formatCurrency(data.totalEquityOpening),
    '',
    '',
    formatCurrency(data.totalEquityClosing),
  ]);

  autoTable(doc, {
    startY: 40,
    head: sceHead,
    body: sceBody,
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontSize: 8.5 },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 56 },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
    didParseCell: (d) => {
      if (d.section === 'body' && d.row.index === sceBody.length - 1) {
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.fillColor = [240, 240, 245];
      }
    },
  });

  // ── Tabel 2: Rekonsiliasi Dividen (Hak vs Aktual) ──
  const afterFirst = (doc as any).lastAutoTable?.finalY ?? 80;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Rekonsiliasi Dividen — Hak vs Aktual', 14, afterFirst + 12);

  const recHead = [['Pemilik', 'Hak (%)', 'Hak Dividen', 'Dividen Aktual', 'Selisih']];
  const recBody: (string | number)[][] = data.dividendReconciliation.map((r) => {
    const owner = data.owners.find((o) => o.stockAccountId === r.stockAccountId);
    return [
      owner ? ownerLabel(owner) : r.ownerName,
      owner ? `${owner.profitSharePct.toFixed(2)}%` : '-',
      formatCurrency(r.entitled),
      formatCurrency(r.actual),
      r.variance >= 0
        ? formatCurrency(r.variance)
        : `(${formatCurrency(Math.abs(r.variance))})`,
    ];
  });

  autoTable(doc, {
    startY: afterFirst + 16,
    head: recHead,
    body: recBody,
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontSize: 8.5 },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  });

  // ── Footer with AXION logo ──
  const faviconBase64 = await loadImageAsBase64('/images/favicon.png');
  const pageCount = (doc as any).internal.getNumberOfPages();
  const footerY = 284;
  const logoSize = 5;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Dicetak oleh AXION pada ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      14,
      footerY + 1
    );
    doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - 14, footerY + 1, { align: 'right' });
    if (faviconBase64) {
      doc.addImage(faviconBase64, 'JPEG', (pageWidth - logoSize) / 2, footerY - 3, logoSize, logoSize);
    }
  }
  doc.setTextColor(0, 0, 0);

  doc.save(`Laporan-Perubahan-Ekuitas-${businessName}-${period}.pdf`);
}

// Export Statement of Changes in Equity to Excel
export function exportSCEToExcel(
  businessName: string,
  period: string,
  data: SCEData
) {
  const rows: (string | number)[][] = [
    ['STATEMENT OF CHANGES IN EQUITY'],
    [businessName],
    [`Periode: ${period}`],
    [],
    ['Komponen', 'Saldo Awal', 'Penambahan', 'Pengurangan', 'Saldo Akhir'],
  ];

  for (const o of data.owners) {
    rows.push([
      `Modal — ${ownerLabel(o)}`,
      o.capitalOpening,
      o.capitalAdditions,
      -o.capitalWithdrawals,
      o.capitalClosing,
    ]);
  }
  rows.push([
    'Laba Ditahan',
    data.retainedOpening,
    data.netIncome >= 0 ? data.netIncome : 0,
    data.netIncome < 0 ? data.netIncome : -data.dividendsDeclared,
    data.retainedClosing,
  ]);
  rows.push(['TOTAL EKUITAS', data.totalEquityOpening, '', '', data.totalEquityClosing]);

  rows.push([]);
  rows.push([]);
  rows.push(['Rekonsiliasi Dividen — Hak vs Aktual']);
  rows.push(['Pemilik', 'Hak (%)', 'Hak Dividen', 'Dividen Aktual', 'Selisih']);
  for (const r of data.dividendReconciliation) {
    const owner = data.owners.find((o) => o.stockAccountId === r.stockAccountId);
    rows.push([
      owner ? ownerLabel(owner) : r.ownerName,
      owner ? owner.profitSharePct : 0,
      r.entitled,
      r.actual,
      r.variance,
    ]);
  }

  rows.push([]);
  rows.push([data.isReconciled ? '✓ Cocok dengan Neraca' : '⚠ Tidak cocok dengan Neraca']);
  rows.push([`Generated on ${new Date().toLocaleDateString('id-ID')}`]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 32 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Perubahan Ekuitas');
  XLSX.writeFile(wb, `Laporan-Perubahan-Ekuitas-${businessName}-${period}.xlsx`);
}

// ═══════════════════════════════════════════════════════════════════════════
// BUKTI PEMBERIAN PINJAMAN (Piutang Talangan) — single-transaction PDF
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Muat gambar lampiran, kompres jadi JPEG, dan kembalikan data URL + dimensi asli
 * (dalam piksel) agar rasio aspek bisa dipertahankan saat ditanam ke PDF.
 * Berbeda dari `loadImageAsBase64` (untuk favicon kecil), ini menjaga resolusi
 * tetap layak dibaca (maxSize besar) untuk struk/bukti transfer.
 */
async function loadImageForEmbed(
  url: string,
  maxSize = 900
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    // credentials disertakan agar proxy same-origin (/api/.../download) menerima
    // cookie auth Supabase; URL eksternal mengabaikan ini tanpa efek samping.
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return null;
    const blob = await res.blob();

    const originalDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image decode failed'));
      el.src = originalDataUrl;
    });

    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    return { dataUrl: canvas.toDataURL('image/jpeg', 0.82), width: w, height: h };
  } catch {
    return null;
  }
}

export interface LoanReceivablePDFData {
  businessName: string;
  transactionNumber: string;
  date: string;
  description: string;
  counterpartyName: string | null;
  amount: number;
  totalPaid: number;
  outstanding: number;
  isFullySettled: boolean;
  debitAccount: { code: string; name: string } | null;
  creditAccount: { code: string; name: string } | null;
  payments: { date: string; description: string; amount: number }[];
  attachments: TransactionAttachment[];
  createdByName?: string | null;
  notes?: string | null;
}

const INDIGO: [number, number, number] = [79, 70, 229];
const EMERALD: [number, number, number] = [5, 150, 105];
const INK: [number, number, number] = [26, 26, 46];
const INK_SOFT: [number, number, number] = [75, 85, 99];
const INK_FAINT: [number, number, number] = [139, 143, 163];
const LINE: [number, number, number] = [226, 228, 238];

/**
 * Generate PDF "BUKTI PEMBERIAN PINJAMAN" untuk transaksi piutang talangan.
 * Menanam gambar lampiran (bukti transfer) langsung ke dalam PDF.
 */
export async function exportLoanReceivablePDF(data: LoanReceivablePDFData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 18;
  const contentW = pageWidth - marginX * 2;
  const footerY = pageHeight - 14;
  let y = 20;

  // Pastikan ruang cukup sebelum menggambar blok; buat halaman baru bila perlu.
  const ensureSpace = (needed: number) => {
    if (y + needed > footerY - 6) {
      doc.addPage();
      y = 20;
    }
  };

  const sectionHead = (label: string) => {
    ensureSpace(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...INK_FAINT);
    doc.text(label.toUpperCase(), marginX, y, { charSpace: 0.4 });
    y += 2.5;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(marginX, y, marginX + contentW, y);
    y += 6;
  };

  // ── Masthead ── (tanpa nama bisnis — atas permintaan)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...INK);
  doc.text('BUKTI PEMBERIAN PINJAMAN', marginX, y, { charSpace: 0.3 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...INK_FAINT);
  doc.text('Piutang Talangan', marginX, y + 6);

  // kanan: nomor + tanggal (tanpa AXION — atas permintaan)
  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.text(`#${data.transactionNumber}`, pageWidth - marginX, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...INK_SOFT);
  doc.text(formatDateWithDay(data.date), pageWidth - marginX, y + 5.5, { align: 'right' });

  y += 15;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.5);
  doc.line(marginX, y, marginX + contentW, y);
  y += 13;

  // ── Hero: nilai + status ──
  const heroTop = y;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...INK_FAINT);
  doc.text('NILAI TRANSAKSI', marginX, heroTop, { charSpace: 0.4 });

  // nominal (beri jarak lebih lega dari label)
  const amountY = heroTop + 11;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...INK);
  doc.text(formatCurrency(data.amount), marginX, amountY);

  // kanan: chip Financing (atas) + status (bawah), keduanya rata kanan & di-stack
  const chipLabel = 'FINANCING';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  const chipW = doc.getTextWidth(chipLabel) + 7;
  const chipX = pageWidth - marginX - chipW;
  const chipCY = heroTop + 1;
  doc.setFillColor(238, 240, 254);
  doc.roundedRect(chipX, chipCY - 3.8, chipW, 5.6, 2.8, 2.8, 'F');
  doc.setTextColor(...INDIGO);
  doc.text(chipLabel, chipX + chipW / 2, chipCY, { align: 'center' });

  const statusLabel = data.isFullySettled ? 'LUNAS' : 'POSTED';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...EMERALD);
  doc.text(statusLabel, pageWidth - marginX, chipCY + 7, { align: 'right', charSpace: 0.5 });

  y = amountY + 8;

  // ── Deskripsi + pihak ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  const descLines = doc.splitTextToSize(data.description || '-', contentW);
  doc.text(descLines, marginX, y);
  y += descLines.length * 5.2 + 1.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK_SOFT);
  const party = data.counterpartyName
    ? `${data.counterpartyName}  ·  Related Party (Penerima Talangan)`
    : 'Related Party (Penerima Talangan)';
  doc.text(party, marginX, y);
  y += 10;

  // ── Jurnal double-entry ──
  sectionHead('Jurnal Double-Entry');
  const drawJournalRow = (side: string, acc: { code: string; name: string } | null) => {
    ensureSpace(9);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...INK_FAINT);
    doc.text(side.toUpperCase(), marginX, y, { charSpace: 0.4 });
    doc.setFont('courier', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK_FAINT);
    doc.text(acc?.code ?? '—', marginX + 22, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(acc?.name ?? 'Unknown', marginX + 36, y);
    // badge tipe akun di kanan
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    const typeLabel = 'ASSET';
    const badgeW = doc.getTextWidth(typeLabel) + 5;
    const badgeX = pageWidth - marginX - badgeW;
    doc.setFillColor(238, 244, 255);
    doc.roundedRect(badgeX, y - 3.2, badgeW, 4.8, 1.2, 1.2, 'F');
    doc.setTextColor(37, 99, 168);
    doc.text(typeLabel, badgeX + badgeW / 2, y, { align: 'center' });
    y += 7;
  };
  drawJournalRow('Debit', data.debitAccount);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(marginX, y - 3.5, marginX + contentW, y - 3.5);
  drawJournalRow('Kredit', data.creditAccount);
  y += 5;

  // ── Riwayat pembayaran ── (kartu berbingkai, mirip pratinjau)
  if (data.payments.length > 0) {
    sectionHead('Riwayat Pembayaran');

    const padX = 5;           // padding kiri/kanan dalam kartu
    const innerL = marginX + padX;
    const innerR = marginX + contentW - padX;
    const headerH = 9;        // baris "RIWAYAT / Sisa"
    const rowH = 11;          // tinggi tiap baris pembayaran
    const totalH = 9;         // baris "Total Terbayar"
    const boxH = headerH + data.payments.length * rowH + totalH;

    ensureSpace(boxH + 2);
    const boxTop = y;

    // bingkai luar kartu
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.roundedRect(marginX, boxTop, contentW, boxH, 2, 2, 'S');

    // header bar (sedikit abu)
    doc.setFillColor(247, 248, 252);
    doc.rect(marginX + 0.2, boxTop + 0.2, contentW - 0.4, headerH - 0.2, 'F');
    let cy = boxTop + headerH / 2 + 1.6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...INK_FAINT);
    doc.text('RIWAYAT', innerL, cy, { charSpace: 0.3 });
    if (!data.isFullySettled) {
      // "Sisa:" (soft) lalu nilai (bold) — dua text right-aligned yang di-stack.
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      const remVal = formatCurrency(data.outstanding);
      doc.text(remVal, innerR, cy, { align: 'right' });
      const remValW = doc.getTextWidth(remVal);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...INK_SOFT);
      doc.text('Sisa: ', innerR - remValW, cy, { align: 'right' });
    }

    // garis bawah header
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(marginX, boxTop + headerH, marginX + contentW, boxTop + headerH);

    // baris pembayaran
    let rowTop = boxTop + headerH;
    for (const p of data.payments) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...INK_FAINT);
      doc.text(formatDate(p.date), innerL, rowTop + 4);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      const descW = contentW - padX * 2 - 42;
      const pLines = doc.splitTextToSize(p.description || 'Pembayaran', descW);
      doc.text(pLines[0], innerL, rowTop + 8.4);
      doc.setTextColor(...EMERALD);
      doc.text(`+${formatCurrency(p.amount)}`, innerR, rowTop + 8.4, { align: 'right' });
      rowTop += rowH;
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.15);
      doc.line(marginX, rowTop, marginX + contentW, rowTop);
    }

    // total terbayar (footer bar)
    doc.setFillColor(247, 248, 252);
    doc.rect(marginX + 0.2, rowTop + 0.2, contentW - 0.4, totalH - 0.4, 'F');
    const ty = rowTop + totalH / 2 + 1.4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK_SOFT);
    doc.text('Total Terbayar', innerL, ty);
    doc.setTextColor(...INK);
    doc.text(formatCurrency(data.totalPaid), innerR, ty, { align: 'right' });

    y = boxTop + boxH + 10;
  }

  // ── Detail ──
  sectionHead('Detail');
  const kv: [string, string][] = [
    ['Kategori', 'Financing (FIN)'],
    ['Status', data.isFullySettled ? 'Lunas' : 'Posted · Belum lunas'],
    ['Nilai pokok', formatCurrency(data.amount)],
    ['Sudah dibayar', formatCurrency(data.totalPaid)],
    ['Sisa piutang', formatCurrency(data.outstanding)],
  ];
  if (data.createdByName) {
    kv.push(['Dibuat oleh', `${data.createdByName} — ${formatDate(data.date)}`]);
  }
  if (data.notes) kv.push(['Catatan', data.notes]);
  for (const [k, v] of kv) {
    ensureSpace(6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK_FAINT);
    doc.text(k, marginX, y);
    doc.setTextColor(...INK);
    const vLines = doc.splitTextToSize(v, contentW - 48);
    doc.text(vLines, marginX + 48, y);
    y += Math.max(1, vLines.length) * 4.6 + 1.4;
  }
  y += 4;

  // ── Sumber dokumen (embed gambar) ──
  // Muat semua gambar DULU (async) + hitung dimensi gambarnya, supaya kita bisa
  // menjaga judul + caption + gambar tetap satu kesatuan di halaman yang sama
  // (kalau tak muat, seluruh blok — termasuk judul section — pindah ke halaman
  // berikutnya, bukan cuma gambarnya).
  if (data.attachments.length > 0) {
    type PreparedAttachment = {
      filename: string;
      captionMeta: string;
      isPdf: boolean;
      img: { dataUrl: string; width: number; height: number } | null;
      drawW: number;
      drawH: number;
    };

    const prepared: PreparedAttachment[] = [];
    for (const att of data.attachments) {
      const mime = (att.mime_type || '').toLowerCase();
      const fn = (att.filename || '').toLowerCase();
      const isPdf = mime.includes('pdf') || fn.endsWith('.pdf');
      const sizeKB = att.size ? `${(att.size / 1024).toFixed(1)} KB` : '';
      const typeStr = isPdf ? 'PDF' : (mime.split('/')[1] || 'gambar').toUpperCase();
      const captionMeta = [sizeKB, typeStr].filter(Boolean).join(' · ');

      let img: PreparedAttachment['img'] = null;
      if (!isPdf) {
        try {
          const resolved = await resolveEmbeddableAttachmentUrl(
            { url: att.url, path: att.path, resource_type: att.resource_type ?? 'image', filename: att.filename },
            300
          );
          img = await loadImageForEmbed(resolved);
        } catch {
          img = null;
        }
      }

      // hitung ukuran gambar (struk biasanya potret): lebar maks ~62% konten, tinggi maks 120mm
      let drawW = 0;
      let drawH = 0;
      if (img) {
        const maxW = Math.min(contentW * 0.62, 95);
        const maxH = 120;
        drawW = maxW;
        drawH = (img.height / img.width) * drawW;
        if (drawH > maxH) {
          drawH = maxH;
          drawW = (img.width / img.height) * drawH;
        }
      }

      prepared.push({ filename: att.filename || 'Lampiran', captionMeta, isPdf, img, drawW, drawH });
    }

    // Tinggi tiap blok caption (nama + meta) ~ 11mm; ditambah tinggi gambar/pesan.
    const captionBlockH = 11;
    const usableBottom = footerY - 6;

    // Section header hanya digambar sekali; tapi ia harus menempel pada
    // lampiran PERTAMA. Cek apakah header + lampiran pertama muat di sisa halaman.
    const firstBlockH = captionBlockH + (prepared[0].img ? prepared[0].drawH + 8 : 8);
    // sectionHead butuh ~12mm; total blok pertama termasuk header:
    if (y + 12 + firstBlockH > usableBottom) {
      doc.addPage();
      y = 20;
    }
    sectionHead('Sumber Dokumen');

    for (let i = 0; i < prepared.length; i++) {
      const p = prepared[i];
      const blockH = captionBlockH + (p.img ? p.drawH + 8 : 8);
      // lampiran ke-2 dst: kalau tak muat, pindah halaman bersama caption+gambarnya.
      if (i > 0 && y + blockH > usableBottom) {
        doc.addPage();
        y = 20;
      }

      // caption: nama file + meta
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...INK);
      const nameLines = doc.splitTextToSize(p.filename, contentW);
      doc.text(nameLines, marginX, y);
      y += nameLines.length * 4.4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...INK_FAINT);
      doc.text(p.captionMeta, marginX, y + 3.6);
      y += 7;

      if (p.isPdf) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(...INK_SOFT);
        doc.text('(Lampiran PDF tidak ditanam — buka di aplikasi untuk melihat.)', marginX, y);
        y += 8;
      } else if (p.img) {
        doc.setDrawColor(...LINE);
        doc.setLineWidth(0.2);
        doc.roundedRect(marginX, y, p.drawW, p.drawH, 1.5, 1.5, 'S');
        doc.addImage(p.img.dataUrl, 'JPEG', marginX, y, p.drawW, p.drawH, undefined, 'FAST');
        y += p.drawH + 8;
      } else {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(...INK_SOFT);
        doc.text('(Gambar lampiran gagal dimuat.)', marginX, y);
        y += 8;
      }
    }
  }

  // ── Footer di setiap halaman ──
  const faviconBase64 = await loadImageAsBase64('/images/favicon.png');
  const pageCount = (doc as any).internal.getNumberOfPages();
  const logoSize = 4.5;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(marginX, footerY - 4, pageWidth - marginX, footerY - 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...INK_FAINT);
    doc.text(
      `Dicetak oleh AXION pada ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      marginX,
      footerY
    );
    doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - marginX, footerY, { align: 'right' });
    if (faviconBase64) {
      doc.addImage(faviconBase64, 'JPEG', (pageWidth - logoSize) / 2, footerY - 3.2, logoSize, logoSize);
    }
  }
  doc.setTextColor(0, 0, 0);

  doc.save(`Bukti-Pemberian-Pinjaman-${data.transactionNumber}.pdf`);
}
