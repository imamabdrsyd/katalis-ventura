import type { FinancialSummary, BalanceSheetData, SCEData } from '@/types';
import { calculateIncomeStatementMetrics } from '../calculations';

/**
 * Penyusun baris laporan keuangan dalam bentuk AoA (array of arrays).
 *
 * Dipisah dari `src/lib/export.ts` karena file itu mengimpor `jspdf`,
 * `jspdf-autotable`, dan `xlsx` di level atas — semuanya browser-only dan
 * tidak bisa hidup di route handler Node. Modul ini murni: hanya type import
 * plus `calculateIncomeStatementMetrics`.
 *
 * Dua konsumen memakai baris yang SAMA PERSIS:
 *   1. `export.ts` → `XLSX.utils.aoa_to_sheet(...)` → file .xlsx
 *   2. route export Google Sheets → `spreadsheets.values.update`
 * sehingga isi laporan tidak pernah bisa menyimpang antar-format.
 */

export type SheetRow = (string | number)[];

/** Nama pemilik untuk baris ekuitas: pakai nama kontak bila ada. */
export const ownerLabel = (o: { contactName: string | null; ownerName: string }): string =>
  o.contactName ?? o.ownerName;

const generatedOn = (): string => `Generated on ${new Date().toLocaleDateString('id-ID')}`;

export function buildIncomeStatementRows(
  businessName: string,
  period: string,
  summary: FinancialSummary
): SheetRow[] {
  const metrics = calculateIncomeStatementMetrics(summary);

  return [
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
    [generatedOn()],
  ];
}

export interface CashFlowExportData {
  operating: number;
  investing: number;
  financing: number;
  netCashFlow: number;
  openingBalance: number;
  closingBalance: number;
}

export function buildCashFlowRows(
  businessName: string,
  period: string,
  data: CashFlowExportData
): SheetRow[] {
  return [
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
    [generatedOn()],
  ];
}

export function buildBalanceSheetRows(
  businessName: string,
  asOfDate: string,
  data: BalanceSheetData
): SheetRow[] {
  const isBalanced =
    Math.abs(
      data.assets.totalAssets - (data.liabilities.totalLiabilities + data.equity.totalEquity)
    ) < 0.01;

  return [
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
    ...(data.assets.otherCurrentAssets !== 0
      ? [['Other Current Assets', data.assets.otherCurrentAssets]]
      : []),
    ['Total Current Assets', data.assets.totalCurrentAssets],
    [],
    ['Fixed Assets', ''],
    ['Nilai Perolehan', data.assets.fixedAssets],
    ...(data.assets.accumulatedDepreciation > 0
      ? [['Akumulasi Penyusutan', -data.assets.accumulatedDepreciation]]
      : []),
    [
      data.assets.accumulatedDepreciation > 0 ? 'Nilai Buku Aset Tetap' : 'Total Fixed Assets',
      data.assets.totalFixedAssets,
    ],
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
    [generatedOn()],
  ];
}

export function buildSCERows(businessName: string, period: string, data: SCEData): SheetRow[] {
  const rows: SheetRow[] = [
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
  rows.push([generatedOn()]);

  return rows;
}
