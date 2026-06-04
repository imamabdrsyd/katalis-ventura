import {
  calculateFinancialSummary,
  calculateIncomeStatementMetrics,
  calculateBalanceSheet,
  applyDepreciationToSummary,
  buildFixedAssetCostMap,
  filterTransactionsByDateRange,
} from '@/lib/calculations';
import { calculateDepreciationSummary } from '@/lib/accounting/depreciation';
import type { Transaction, Account, FinancialSummary } from '@/types';

/**
 * Helper untuk membangun konteks keuangan yang diinject ke prompt AXION Agent.
 *
 * PENTING: semua angka P&L di sini WAJIB memakai engine yang sama persis dengan
 * halaman Income Statement (calculateFinancialSummary + applyDepreciationToSummary),
 * supaya jawaban AI tidak pernah menyimpang dari laporan resmi. Fungsi ini dipisah
 * dari route handler agar bisa di-unit-test (lihat tests/unit/aiFinancialContext.test.ts).
 */

export function formatIDR(amount: number): string {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(amount));
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/**
 * Hitung FinancialSummary lengkap dengan depresiasi periode — replikasi PERSIS
 * langkah useIncomeStatement: calculateFinancialSummary → calculateDepreciationSummary
 * (pakai fixed asset cost map kumulatif dari SEMUA transaksi) → applyDepreciationToSummary.
 *
 * Tanpa langkah ini, netProfit tidak mengurangi depresiasi → tidak match halaman laporan.
 */
export function computeSummary(
  rangeTransactions: Transaction[],
  allTransactions: Transaction[],
  accounts: Account[],
  startDate: string,
  endDate: string
): FinancialSummary {
  const base = calculateFinancialSummary(rangeTransactions);
  if (accounts.length === 0) return base;

  // Cost map kumulatif dari SEMUA transaksi (cost aset bersifat akumulatif)
  const fixedAssetCosts = buildFixedAssetCostMap(allTransactions);
  const depSummary = calculateDepreciationSummary(
    accounts,
    (accountId) => fixedAssetCosts.get(accountId) ?? 0,
    new Date(endDate),
    new Date(startDate)
  );
  return applyDepreciationToSummary(base, depSummary.periodDepreciation);
}

/**
 * Income statement proper untuk satu bulan — pakai engine yang SAMA dengan
 * halaman laporan (double-entry + depresiasi periode), bukan SUM(amount) mentah.
 * Return string kosong kalau tidak ada transaksi di bulan tsb.
 */
export function monthlyIncomeStatement(
  allTransactions: Transaction[],
  accounts: Account[],
  month: string
): string {
  const start = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const end = new Date(y, m, 0).toISOString().split('T')[0]; // last day of month
  const inMonth = filterTransactionsByDateRange(allTransactions, start, end);
  if (inMonth.length === 0) return '';

  const summary = computeSummary(inMonth, allTransactions, accounts, start, end);
  const metrics = calculateIncomeStatementMetrics(summary);
  const label = `${MONTH_NAMES_ID[m - 1]} ${y}`;

  return `  ${label}: Revenue ${formatIDR(summary.totalEarn)} | HPP ${formatIDR(summary.totalVar)} | Laba Kotor ${formatIDR(summary.grossProfit)} | OpEx ${formatIDR(summary.totalOpex)} | Depresiasi ${formatIDR(summary.totalDepreciation)} | Pajak ${formatIDR(summary.totalTax)} | Bunga ${formatIDR(summary.totalInterest)} | Laba Bersih ${formatIDR(summary.netProfit)} (margin ${metrics.netMargin.toFixed(1)}%)`;
}

/**
 * Bangun blok teks konteks keuangan untuk diinject ke prompt Gemini.
 * Output ringkas (~1-2KB) — transaksi mentah TIDAK dikirim ke AI, hanya hasil agregat.
 */
export function buildFinancialContext(
  businessName: string,
  businessSector: string,
  transactions: Transaction[],
  accounts: Account[],
  today: Date
): string {
  if (transactions.length === 0) {
    return `BISNIS: ${businessName} (${businessSector})\nBelum ada data transaksi.`;
  }

  const endDate = today.toISOString().split('T')[0];
  // All-time summary: depresiasi dihitung dari awal data sampai hari ini.
  const firstDate = transactions
    .map((t) => t.date)
    .reduce((min, d) => (d < min ? d : min), endDate);
  const allSummary = computeSummary(transactions, transactions, accounts, firstDate, endDate);
  const allMetrics = calculateIncomeStatementMetrics(allSummary);
  const balanceSheet = calculateBalanceSheet(transactions, allSummary.totalFin);

  // P&L proper per-bulan untuk 6 bulan terakhir (termasuk bulan berjalan).
  // Tiap bulan pakai engine + depresiasi yang sama dgn halaman Income Statement.
  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const monthRows = monthKeys
    .map((mk) => monthlyIncomeStatement(transactions, accounts, mk))
    .filter(Boolean)
    .join('\n');

  // Top 5 transaksi terbesar 3 bulan terakhir (untuk konteks "apa yang besar")
  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1)
    .toISOString().split('T')[0];
  const recent = filterTransactionsByDateRange(transactions, threeMonthsAgo, endDate);
  const topTx = [...recent]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((tx) => `  - ${tx.date} | ${tx.name} | ${tx.category} | ${formatIDR(tx.amount)}`)
    .join('\n');

  return `=== KONTEKS KEUANGAN BISNIS ===
Bisnis: ${businessName}
Sektor: ${businessSector}
Tanggal hari ini: ${endDate}
Total transaksi posted (all-time): ${transactions.length}

--- LABA RUGI PER BULAN (6 bulan terakhir, akurat sesuai halaman Income Statement) ---
${monthRows || '  (belum ada data di rentang ini)'}

--- RINGKASAN ALL-TIME ---
Revenue: ${formatIDR(allSummary.totalEarn)}
HPP/Variabel: ${formatIDR(allSummary.totalVar)}
Laba Kotor: ${formatIDR(allSummary.grossProfit)}
Beban Operasional: ${formatIDR(allSummary.totalOpex)}
Depresiasi: ${formatIDR(allSummary.totalDepreciation)}
Pajak: ${formatIDR(allSummary.totalTax)}
Bunga: ${formatIDR(allSummary.totalInterest)}
Laba Bersih: ${formatIDR(allSummary.netProfit)}
Gross Margin: ${allMetrics.grossMargin.toFixed(1)}% | Net Margin: ${allMetrics.netMargin.toFixed(1)}%

--- NERACA (all-time) ---
Total Aset: ${formatIDR(balanceSheet.assets.totalAssets)}
Total Liabilitas: ${formatIDR(balanceSheet.liabilities.totalLiabilities)}
Total Ekuitas: ${formatIDR(balanceSheet.equity.totalEquity)}
Kas & Bank: ${formatIDR(balanceSheet.assets.cash)}

--- 5 TRANSAKSI TERBESAR (3 bulan terakhir) ---
${topTx || '  (belum ada data)'}

CATATAN: Semua angka laba rugi per bulan SUDAH dihitung dengan engine double-entry
yang sama persis dengan halaman Income Statement. Gunakan angka per-bulan di atas
untuk pertanyaan spesifik bulan tertentu — JANGAN mengira-ngira atau membagi rata.
=== END KONTEKS ===`;
}
