import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createAdminClient } from '@/lib/supabase-server';
import {
  calculateFinancialSummary,
  calculateIncomeStatementMetrics,
  calculateBalanceSheet,
  calculateCashFlow,
  calculateInitialCapital,
} from '@/lib/calculations';
import type { Transaction, Account } from '@/types';
import { formatCurrency } from '@/lib/utils';

async function fetchTransactionsForPeriod(
  businessId: string,
  startDate: string,
  endDate: string
): Promise<{ inRange: Transaction[]; all: Transaction[]; businessName: string; accounts: Account[] }> {
  const admin = createAdminClient();

  const [bizRes, allTxRes, accountsRes] = await Promise.all([
    admin.from('businesses').select('business_name').eq('id', businessId).single(),
    admin
      .from('active_transactions')
      .select(`
        *,
        debit_account:accounts!transactions_debit_account_id_fkey(id, account_code, account_name, account_type, normal_balance),
        credit_account:accounts!transactions_credit_account_id_fkey(id, account_code, account_name, account_type, normal_balance)
      `)
      .eq('business_id', businessId)
      .order('date', { ascending: true }),
    admin.from('accounts').select('*').eq('business_id', businessId),
  ]);

  const allTransactions = (allTxRes.data ?? []) as Transaction[];
  const inRange = allTransactions.filter((t) => t.date >= startDate && t.date <= endDate);

  return {
    inRange,
    all: allTransactions,
    businessName: bizRes.data?.business_name ?? 'Bisnis',
    accounts: (accountsRes.data ?? []) as Account[],
  };
}

function addHeader(doc: jsPDF, title: string, businessName: string, periodLabel: string) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(12);
  doc.setTextColor(99, 102, 241);
  doc.text(businessName, pageWidth / 2, 26, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Periode: ${periodLabel}`, pageWidth / 2, 33, { align: 'center' });
  doc.setTextColor(0, 0, 0);
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Digenerate via AXION Bot — ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    doc.setTextColor(0, 0, 0);
  }
}

// ───────────────────────────────────────
// INCOME STATEMENT
// ───────────────────────────────────────
export async function generateIncomeStatementPDF(
  businessId: string,
  startDate: string,
  endDate: string,
  periodLabel: string
): Promise<Buffer> {
  const { inRange, businessName } = await fetchTransactionsForPeriod(businessId, startDate, endDate);

  const summary = calculateFinancialSummary(inRange);
  const metrics = calculateIncomeStatementMetrics(summary);

  const doc = new jsPDF();
  addHeader(doc, 'LAPORAN LABA RUGI', businessName, periodLabel);

  type Row = [string, string];
  const rows: Row[] = [
    ['PENDAPATAN', ''],
    ['  Total Pendapatan', formatCurrency(summary.totalEarn)],
    ['', ''],
    ['HARGA POKOK PENJUALAN', ''],
    ['  Total HPP', `(${formatCurrency(summary.totalVar)})`],
    ['', ''],
    ['LABA KOTOR', formatCurrency(summary.grossProfit)],
    [`  Margin Laba Kotor`, `${metrics.grossMargin.toFixed(2)}%`],
    ['', ''],
    ['BEBAN OPERASIONAL', ''],
    ['  Total Beban Operasional', `(${formatCurrency(summary.totalOpex)})`],
    ['', ''],
    ['LABA OPERASI', formatCurrency(metrics.operatingIncome)],
    [`  Margin Operasi`, `${metrics.operatingMargin.toFixed(2)}%`],
    ['', ''],
    ['BEBAN BUNGA', `(${formatCurrency(summary.totalInterest)})`],
    ['LABA SEBELUM PAJAK', formatCurrency(metrics.ebt)],
    ['BEBAN PAJAK', `(${formatCurrency(summary.totalTax)})`],
    ['', ''],
    ['LABA BERSIH', formatCurrency(summary.netProfit)],
    [`  Margin Laba Bersih`, `${metrics.netMargin.toFixed(2)}%`],
  ];

  autoTable(doc, {
    startY: 42,
    body: rows,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 60, halign: 'right' },
    },
    didParseCell: (data) => {
      const label = (data.row.raw as Row)[0];
      const isTotal = /^(LABA BERSIH|LABA OPERASI|LABA KOTOR|LABA SEBELUM PAJAK)$/.test(label);
      const isSection = /^(PENDAPATAN|HARGA POKOK PENJUALAN|BEBAN OPERASIONAL|BEBAN BUNGA|BEBAN PAJAK)$/.test(label);
      if (isTotal) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 240, 250];
      } else if (isSection) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  addFooter(doc);
  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

// ───────────────────────────────────────
// BALANCE SHEET
// ───────────────────────────────────────
export async function generateBalanceSheetPDF(
  businessId: string,
  asOfDate: string,
  periodLabel: string
): Promise<Buffer> {
  const admin = createAdminClient();
  const [bizRes, allTxRes, accountsRes] = await Promise.all([
    admin.from('businesses').select('business_name').eq('id', businessId).single(),
    admin
      .from('active_transactions')
      .select(`
        *,
        debit_account:accounts!transactions_debit_account_id_fkey(id, account_code, account_name, account_type, normal_balance),
        credit_account:accounts!transactions_credit_account_id_fkey(id, account_code, account_name, account_type, normal_balance)
      `)
      .eq('business_id', businessId)
      .lte('date', asOfDate)
      .order('date', { ascending: true }),
    admin.from('accounts').select('*').eq('business_id', businessId),
  ]);

  const businessName = bizRes.data?.business_name ?? 'Bisnis';
  const transactions = (allTxRes.data ?? []) as Transaction[];
  const accounts = (accountsRes.data ?? []) as Account[];
  const capital = calculateInitialCapital(transactions);

  const bs = calculateBalanceSheet(transactions, capital, accounts, new Date(asOfDate));

  const doc = new jsPDF();
  addHeader(doc, 'NERACA', businessName, `Per ${periodLabel}`);

  type Row = [string, string];
  const rows: Row[] = [
    ['ASET', ''],
    ['  Kas & Setara Kas', formatCurrency(bs.assets.cash)],
    ['  Piutang', formatCurrency(bs.assets.receivables)],
    ['  Persediaan', formatCurrency(bs.assets.inventory)],
    ['  Aset Lancar Lainnya', formatCurrency(bs.assets.otherCurrentAssets)],
    ['  Aset Tetap (Neto)', formatCurrency(bs.assets.netFixedAssets)],
    ['TOTAL ASET', formatCurrency(bs.assets.totalAssets)],
    ['', ''],
    ['LIABILITAS', ''],
    ['  Pinjaman', formatCurrency(bs.liabilities.loans)],
    ['  Total Liabilitas', formatCurrency(bs.liabilities.totalLiabilities)],
    ['', ''],
    ['EKUITAS', ''],
    ['  Modal Disetor', formatCurrency(bs.equity.capital)],
    ['  Prive', `(${formatCurrency(bs.equity.drawings)})`],
    ['  Laba Ditahan', formatCurrency(bs.equity.retainedEarnings)],
    ['TOTAL EKUITAS', formatCurrency(bs.equity.totalEquity)],
    ['', ''],
    ['TOTAL LIABILITAS + EKUITAS', formatCurrency(bs.liabilities.totalLiabilities + bs.equity.totalEquity)],
  ];

  autoTable(doc, {
    startY: 42,
    body: rows,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 60, halign: 'right' },
    },
    didParseCell: (data) => {
      const label = (data.row.raw as Row)[0];
      const isTotal = /^(TOTAL ASET|TOTAL EKUITAS|TOTAL LIABILITAS \+ EKUITAS)$/.test(label);
      const isSection = /^(ASET|LIABILITAS|EKUITAS)$/.test(label);
      if (isTotal) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 240, 250];
      } else if (isSection) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  addFooter(doc);
  return Buffer.from(doc.output('arraybuffer'));
}

// ───────────────────────────────────────
// CASH FLOW
// ───────────────────────────────────────
export async function generateCashFlowPDF(
  businessId: string,
  startDate: string,
  endDate: string,
  periodLabel: string
): Promise<Buffer> {
  const { inRange, all, businessName } = await fetchTransactionsForPeriod(businessId, startDate, endDate);
  const capital = calculateInitialCapital(all);
  const cf = calculateCashFlow(inRange, capital, all, startDate);

  const doc = new jsPDF();
  addHeader(doc, 'LAPORAN ARUS KAS', businessName, periodLabel);

  type Row = [string, string];
  const netCashFlow = cf.operating + cf.investing + cf.financing;
  const rows: Row[] = [
    ['AKTIVITAS OPERASI', ''],
    ['  Arus Kas dari Operasi', formatCurrency(cf.operating)],
    ['', ''],
    ['AKTIVITAS INVESTASI', ''],
    ['  Arus Kas dari Investasi', formatCurrency(cf.investing)],
    ['', ''],
    ['AKTIVITAS PEMBIAYAAN', ''],
    ['  Arus Kas dari Pembiayaan', formatCurrency(cf.financing)],
    ['', ''],
    ['KENAIKAN/PENURUNAN KAS BERSIH', formatCurrency(netCashFlow)],
    ['  Saldo Kas Awal', formatCurrency(cf.openingBalance)],
    ['  Saldo Kas Akhir', formatCurrency(cf.closingBalance)],
  ];

  autoTable(doc, {
    startY: 42,
    body: rows,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 60, halign: 'right' },
    },
    didParseCell: (data) => {
      const label = (data.row.raw as Row)[0];
      const isTotal = /^KENAIKAN\/PENURUNAN KAS BERSIH$/.test(label);
      const isSection = /^(AKTIVITAS OPERASI|AKTIVITAS INVESTASI|AKTIVITAS PEMBIAYAAN)$/.test(label);
      if (isTotal) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 240, 250];
      } else if (isSection) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  addFooter(doc);
  return Buffer.from(doc.output('arraybuffer'));
}
