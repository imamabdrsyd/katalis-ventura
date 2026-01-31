import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { FinancialSummary } from '@/types';
import { formatCurrency } from './utils';

// Export Income Statement to PDF
export function exportIncomeStatementToPDF(
  businessName: string,
  period: string,
  summary: FinancialSummary
) {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(18);
  doc.text('INCOME STATEMENT', 105, 15, { align: 'center' });

  // Business name
  doc.setFontSize(12);
  doc.text(businessName, 105, 25, { align: 'center' });

  // Period
  doc.setFontSize(10);
  doc.text(`Period: ${period}`, 105, 32, { align: 'center' });

  // Calculate metrics
  const grossProfit = summary.totalEarn - summary.totalVar;
  const grossMargin = summary.totalEarn > 0 ? (grossProfit / summary.totalEarn) * 100 : 0;
  const operatingIncome = grossProfit - summary.totalOpex;
  const ebitda = operatingIncome;
  const ebit = ebitda; // Assuming no D&A tracked separately
  const ebt = ebit - summary.totalFin;
  const netIncome = summary.netProfit;
  const netMargin = summary.totalEarn > 0 ? (netIncome / summary.totalEarn) * 100 : 0;

  // Table data
  const tableData = [
    ['REVENUE', ''],
    ['  Total Revenue', formatCurrency(summary.totalEarn)],
    ['', ''],
    ['COST OF GOODS SOLD', ''],
    ['  Variable Costs', `(${formatCurrency(summary.totalVar)})`],
    ['', ''],
    ['GROSS PROFIT', formatCurrency(grossProfit)],
    ['  Gross Margin', `${grossMargin.toFixed(2)}%`],
    ['', ''],
    ['OPERATING EXPENSES', ''],
    ['  Operating Expenses', `(${formatCurrency(summary.totalOpex)})`],
    ['', ''],
    ['OPERATING INCOME (EBITDA)', formatCurrency(operatingIncome)],
    ['', ''],
    ['EBIT', formatCurrency(ebit)],
    ['', ''],
    ['FINANCING COSTS', ''],
    ['  Interest & Financing', `(${formatCurrency(Math.abs(summary.totalFin))})`],
    ['', ''],
    ['EARNINGS BEFORE TAX (EBT)', formatCurrency(ebt)],
    ['', ''],
    ['TAX', ''],
    ['  Tax', `(${formatCurrency(summary.totalTax)})`],
    ['', ''],
    ['NET INCOME', formatCurrency(netIncome)],
    ['  Net Margin', `${netMargin.toFixed(2)}%`],
  ];

  // Generate table
  autoTable(doc, {
    startY: 40,
    head: [['Description', 'Amount']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [99, 102, 241], // Indigo color
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
      // Bold specific rows
      if (data.row.index !== undefined) {
        const text = data.cell.raw as string;
        if (
          text === 'GROSS PROFIT' ||
          text === 'OPERATING INCOME (EBITDA)' ||
          text === 'EBIT' ||
          text === 'EARNINGS BEFORE TAX (EBT)' ||
          text === 'NET INCOME'
        ) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [243, 244, 246]; // Light gray
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
  doc.save(`Income-Statement-${businessName}-${period}.pdf`);
}

// Export Income Statement to Excel
export function exportIncomeStatementToExcel(
  businessName: string,
  period: string,
  summary: FinancialSummary
) {
  // Calculate metrics
  const grossProfit = summary.totalEarn - summary.totalVar;
  const grossMargin = summary.totalEarn > 0 ? (grossProfit / summary.totalEarn) * 100 : 0;
  const operatingIncome = grossProfit - summary.totalOpex;
  const ebitda = operatingIncome;
  const ebit = ebitda;
  const ebt = ebit - summary.totalFin;
  const netIncome = summary.netProfit;
  const netMargin = summary.totalEarn > 0 ? (netIncome / summary.totalEarn) * 100 : 0;

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
    ['GROSS PROFIT', grossProfit],
    ['Gross Margin (%)', grossMargin],
    [],
    ['OPERATING EXPENSES', ''],
    ['Operating Expenses', -summary.totalOpex],
    [],
    ['OPERATING INCOME (EBITDA)', operatingIncome],
    [],
    ['EBIT', ebit],
    [],
    ['FINANCING COSTS', ''],
    ['Interest & Financing', -Math.abs(summary.totalFin)],
    [],
    ['EARNINGS BEFORE TAX (EBT)', ebt],
    [],
    ['TAX', ''],
    ['Tax', -summary.totalTax],
    [],
    ['NET INCOME', netIncome],
    ['Net Margin (%)', netMargin],
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
