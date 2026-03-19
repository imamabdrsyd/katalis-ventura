import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { FinancialSummary, BalanceSheetData, CashFlowData, Transaction } from '@/types';
import { formatCurrency } from './utils';
import { calculateIncomeStatementMetrics } from './calculations';

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

/** Load an image from a URL and return as base64 data URI */
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Export Income Statement to PDF — Xero-inspired layout with per-account breakdown
export async function exportIncomeStatementToPDF(
  businessName: string,
  period: string,
  summary: FinancialSummary,
  transactionsByCategory?: TransactionsByCategory
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const metrics = calculateIncomeStatementMetrics(summary);

  // ── Header ──
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('LAPORAN LABA RUGI', pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(businessName, pageWidth / 2, 26, { align: 'center' });

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

  // ── REVENUE ──
  section('PENDAPATAN');
  if (transactionsByCategory?.revenue.length) {
    const revenueItems = groupByAccount(transactionsByCategory.revenue, 'credit');
    for (const r of revenueItems) item(r.name, r.total);
  } else if (summary.totalEarn > 0) {
    item('Pendapatan', summary.totalEarn);
  }
  subtotal('TOTAL PENDAPATAN', summary.totalEarn);
  blank();

  // ── COST OF SALES ──
  section('HARGA POKOK PENJUALAN');
  if (transactionsByCategory?.cogs.length) {
    const cogsItems = groupByAccount(transactionsByCategory.cogs, 'debit');
    for (const c of cogsItems) item(c.name, c.total);
  } else if (summary.totalVar > 0) {
    item('Harga pokok penjualan', summary.totalVar);
  }
  subtotal('TOTAL HARGA POKOK PENJUALAN', summary.totalVar, true);
  blank();

  // ── GROSS PROFIT ──
  total('LABA KOTOR', summary.grossProfit);
  if (summary.totalEarn > 0) margin('Margin kotor', metrics.grossMargin);
  blank();

  // ── OPERATING EXPENSES ──
  section('BEBAN USAHA');
  if (transactionsByCategory?.opex.length) {
    const opexItems = groupByAccount(transactionsByCategory.opex, 'debit');
    for (const o of opexItems) item(o.name, o.total);
  } else if (summary.totalOpex > 0) {
    item('Beban operasional', summary.totalOpex);
  }
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
    if (transactionsByCategory?.interest.length) {
      const interestItems = groupByAccount(transactionsByCategory.interest, 'debit');
      for (const f of interestItems) item(f.name, f.total);
    } else {
      item('Beban bunga & pembiayaan', summary.totalInterest);
    }
    subtotal('TOTAL BEBAN LAIN-LAIN', summary.totalInterest, true);
    blank();
  }

  // ── EBT ──
  total('LABA SEBELUM PAJAK', metrics.ebt);
  blank();

  // ── TAX ──
  if (summary.totalTax > 0) {
    section('PAJAK');
    if (transactionsByCategory?.tax.length) {
      const taxItems = groupByAccount(transactionsByCategory.tax, 'debit');
      for (const t of taxItems) item(t.name, t.total);
    } else {
      item('Pajak', summary.totalTax);
    }
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
      doc.addImage(faviconBase64, 'PNG', (pageWidth - logoSize) / 2, footerY - 3, logoSize, logoSize);
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
export function exportCashFlowToPDF(
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

  // Title
  doc.setFontSize(18);
  doc.text('CASH FLOW STATEMENT', 105, 15, { align: 'center' });

  // Business name
  doc.setFontSize(12);
  doc.text(businessName, 105, 25, { align: 'center' });

  // Period
  doc.setFontSize(10);
  doc.text(`Period: ${period}`, 105, 32, { align: 'center' });

  // Table data
  const tableData = [
    ['Opening Balance', formatCurrency(data.openingBalance)],
    ['', ''],
    ['OPERATING ACTIVITIES', ''],
    ['  Cash from Operations', formatCurrency(data.operating)],
    ['', ''],
    ['INVESTING ACTIVITIES', ''],
    ['  Capital Expenditure', formatCurrency(data.investing)],
    ['', ''],
    ['FINANCING ACTIVITIES', ''],
    ['  Financing Cash Flow', formatCurrency(data.financing)],
    ['', ''],
    ['NET CASH FLOW', formatCurrency(data.netCashFlow)],
    ['', ''],
    ['CLOSING BALANCE', formatCurrency(data.closingBalance)],
  ];

  // Generate table
  autoTable(doc, {
    startY: 40,
    head: [['Description', 'Amount']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [99, 102, 241],
      fontSize: 11,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 10,
    },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 60, halign: 'right' },
    },
    didParseCell: function (data) {
      if (data.row.index !== undefined) {
        const text = data.cell.raw as string;
        if (
          text === 'Opening Balance' ||
          text === 'NET CASH FLOW' ||
          text === 'CLOSING BALANCE'
        ) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [243, 244, 246];
        }
      }
    },
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  doc.setFontSize(8);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(
      `Generated on ${new Date().toLocaleDateString('id-ID')} - Page ${i} of ${pageCount}`,
      105,
      285,
      { align: 'center' }
    );
  }

  // Save
  doc.save(`Cash-Flow-${businessName}-${period}.pdf`);
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

// Export Balance Sheet to PDF
export function exportBalanceSheetToPDF(
  businessName: string,
  asOfDate: string,
  data: BalanceSheetData
) {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(18);
  doc.text('BALANCE SHEET', 105, 15, { align: 'center' });

  // Business name
  doc.setFontSize(12);
  doc.text(businessName, 105, 25, { align: 'center' });

  // As of date
  doc.setFontSize(10);
  doc.text(`As of: ${asOfDate}`, 105, 32, { align: 'center' });

  // Check if balanced
  const isBalanced = Math.abs(
    data.assets.totalAssets - (data.liabilities.totalLiabilities + data.equity.totalEquity)
  ) < 0.01;

  // Assets table
  const assetsRows: string[][] = [
    ['ASSETS', ''],
    ['', ''],
    ['Current Assets', ''],
    ['  Cash & Bank', formatCurrency(data.assets.cash)],
  ];
  if (data.assets.inventory !== 0) {
    assetsRows.push(['  Inventory', formatCurrency(data.assets.inventory)]);
  }
  if (data.assets.receivables !== 0) {
    assetsRows.push(['  Receivables', formatCurrency(data.assets.receivables)]);
  }
  if (data.assets.otherCurrentAssets !== 0) {
    assetsRows.push(['  Other Current Assets', formatCurrency(data.assets.otherCurrentAssets)]);
  }
  assetsRows.push(
    ['Total Current Assets', formatCurrency(data.assets.totalCurrentAssets)],
    ['', ''],
    ['Fixed Assets', ''],
    ['  Nilai Perolehan', formatCurrency(data.assets.fixedAssets)],
    ...(data.assets.accumulatedDepreciation > 0
      ? [['  Akumulasi Penyusutan', `(${formatCurrency(data.assets.accumulatedDepreciation)})`]]
      : []),
    [data.assets.accumulatedDepreciation > 0 ? 'Nilai Buku Aset Tetap' : 'Total Fixed Assets', formatCurrency(data.assets.totalFixedAssets)],
    ['', ''],
    ['TOTAL ASSETS', formatCurrency(data.assets.totalAssets)],
  );
  const assetsData = assetsRows;

  autoTable(doc, {
    startY: 40,
    head: [],
    body: assetsData,
    theme: 'grid',
    styles: { fontSize: 10 },
    headStyles: { fillColor: [59, 130, 246] },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 60, halign: 'right' },
    },
  });

  // Liabilities & Equity table
  const finalY = (doc as any).lastAutoTable.finalY + 10;

  const liabilitiesEquityData = [
    ['LIABILITIES & EQUITY', ''],
    ['', ''],
    ['Liabilities', ''],
    ['  Loans', formatCurrency(data.liabilities.loans)],
    ['Total Liabilities', formatCurrency(data.liabilities.totalLiabilities)],
    ['', ''],
    ['Equity', ''],
    ['  Modal Disetor', formatCurrency(data.equity.capital)],
    ...(data.equity.drawings > 0 ? [['  Prive / Dividen', `(${formatCurrency(data.equity.drawings)})`]] : []),
    ['  Retained Earnings', formatCurrency(data.equity.retainedEarnings)],
    ['Total Equity', formatCurrency(data.equity.totalEquity)],
    ['', ''],
    [
      'TOTAL LIABILITIES & EQUITY',
      formatCurrency(data.liabilities.totalLiabilities + data.equity.totalEquity),
    ],
    ['', ''],
    [
      isBalanced ? '✓ Balanced' : '⚠ Not Balanced',
      isBalanced
        ? 'Assets = Liabilities + Equity'
        : 'Assets ≠ Liabilities + Equity',
    ],
  ];

  autoTable(doc, {
    startY: finalY,
    head: [],
    body: liabilitiesEquityData,
    theme: 'grid',
    styles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 60, halign: 'right' },
    },
  });

  // Footer
  const footerY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(8);
  doc.text(`Generated on ${new Date().toLocaleDateString('id-ID')}`, 105, footerY, {
    align: 'center',
  });

  // Save
  doc.save(`Balance-Sheet-${businessName}-${asOfDate}.pdf`);
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
    ...(data.equity.drawings > 0 ? [['Prive / Dividen', -data.equity.drawings]] : []),
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
