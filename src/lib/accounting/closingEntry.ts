/**
 * Automatic Closing Entry (Jurnal Penutup)
 *
 * Di akhir tahun buku, akun Revenue & Expense ditutup ke "Laba Ditahan" (Retained Earnings).
 * Proses:
 *   1. Hitung net balance setiap akun Revenue dan Expense untuk periode tersebut
 *   2. Generate closing entries:
 *      - Dr Revenue accounts / Cr Laba Ditahan (tutup pendapatan)
 *      - Dr Laba Ditahan / Cr Expense accounts (tutup beban)
 *   3. Hasil: semua Revenue & Expense = 0, laba/rugi masuk ekuitas
 */

import { createClient } from '@/lib/supabase';
import type { Account, Transaction } from '@/types';

export interface ClosingEntryLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: 'REVENUE' | 'EXPENSE';
  balance: number; // positive = net debit for expense, net credit for revenue
}

export interface ClosingEntryPreview {
  period: { start: string; end: string };
  revenueLines: ClosingEntryLine[];
  expenseLines: ClosingEntryLine[];
  totalRevenue: number;
  totalExpense: number;
  netIncome: number; // revenue - expense (positive = profit)
  retainedEarningsAccountId: string | null;
}

/**
 * Find or identify the Retained Earnings account.
 * Convention: account code 3200 or name containing "laba ditahan" / "retained earnings"
 */
function findRetainedEarningsAccount(accounts: Account[]): Account | null {
  // Try by code first
  const byCode = accounts.find(
    (a) => a.account_type === 'EQUITY' && a.account_code === '3200' && a.is_active
  );
  if (byCode) return byCode;

  // Try by name
  const byName = accounts.find(
    (a) =>
      a.account_type === 'EQUITY' &&
      a.is_active &&
      /laba ditahan|retained earnings/i.test(a.account_name)
  );
  if (byName) return byName;

  return null;
}

/**
 * Calculate net balance per account for Revenue and Expense accounts in a period.
 */
function calculateAccountBalances(
  transactions: Transaction[],
  accounts: Account[],
  startDate: string,
  endDate: string,
): { revenueLines: ClosingEntryLine[]; expenseLines: ClosingEntryLine[] } {
  // Filter to period + posted only
  const periodTxns = transactions.filter(
    (t) => t.status === 'posted' && t.date >= startDate && t.date <= endDate && !t.deleted_at
  );

  // Accumulate balance per account
  const balanceMap = new Map<string, number>(); // accountId → net balance

  for (const t of periodTxns) {
    const amount = Number(t.amount);

    if (t.is_multi_line) {
      for (const line of (t.journal_lines ?? [])) {
        if (!line.account) continue;
        const prev = balanceMap.get(line.account_id) ?? 0;
        // For Revenue: credits increase, debits decrease
        // For Expense: debits increase, credits decrease
        balanceMap.set(line.account_id, prev + line.debit_amount - line.credit_amount);
      }
    } else if (t.is_double_entry) {
      if (t.debit_account_id) {
        const prev = balanceMap.get(t.debit_account_id) ?? 0;
        balanceMap.set(t.debit_account_id, prev + amount);
      }
      if (t.credit_account_id) {
        const prev = balanceMap.get(t.credit_account_id) ?? 0;
        balanceMap.set(t.credit_account_id, prev - amount);
      }
    }
  }

  const revenueLines: ClosingEntryLine[] = [];
  const expenseLines: ClosingEntryLine[] = [];

  for (const acc of accounts) {
    if (!acc.is_active) continue;
    const balance = balanceMap.get(acc.id) ?? 0;
    if (Math.abs(balance) < 0.01) continue; // Skip zero balances

    if (acc.account_type === 'REVENUE') {
      // Revenue normal = CREDIT, so net balance is negative (credits > debits)
      // We want the positive credit balance
      revenueLines.push({
        accountId: acc.id,
        accountCode: acc.account_code,
        accountName: acc.account_name,
        accountType: 'REVENUE',
        balance: Math.abs(balance), // credit balance as positive
      });
    } else if (acc.account_type === 'EXPENSE') {
      // Expense normal = DEBIT, so net balance is positive (debits > credits)
      expenseLines.push({
        accountId: acc.id,
        accountCode: acc.account_code,
        accountName: acc.account_name,
        accountType: 'EXPENSE',
        balance: Math.abs(balance), // debit balance as positive
      });
    }
  }

  return { revenueLines, expenseLines };
}

/**
 * Generate a preview of closing entries for a given period.
 * Does NOT create any transactions — only returns what would be created.
 */
export function previewClosingEntries(
  transactions: Transaction[],
  accounts: Account[],
  startDate: string,
  endDate: string,
): ClosingEntryPreview {
  const { revenueLines, expenseLines } = calculateAccountBalances(
    transactions, accounts, startDate, endDate
  );

  const totalRevenue = revenueLines.reduce((s, l) => s + l.balance, 0);
  const totalExpense = expenseLines.reduce((s, l) => s + l.balance, 0);
  const netIncome = totalRevenue - totalExpense;

  const retainedEarnings = findRetainedEarningsAccount(accounts);

  return {
    period: { start: startDate, end: endDate },
    revenueLines,
    expenseLines,
    totalRevenue,
    totalExpense,
    netIncome,
    retainedEarningsAccountId: retainedEarnings?.id ?? null,
  };
}

/**
 * Execute closing entries: create journal transactions that close Revenue & Expense
 * to Retained Earnings. Returns the IDs of created transactions.
 */
export async function executeClosingEntries(
  businessId: string,
  userId: string,
  preview: ClosingEntryPreview,
): Promise<string[]> {
  if (!preview.retainedEarningsAccountId) {
    throw new Error('Akun Laba Ditahan (kode 3200) tidak ditemukan. Silakan buat akun ekuitas "Laba Ditahan" terlebih dahulu.');
  }

  const supabase = createClient();
  const closingDate = preview.period.end;
  const createdIds: string[] = [];

  // 1. Close Revenue accounts: Dr Revenue / Cr Laba Ditahan
  for (const line of preview.revenueLines) {
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        business_id: businessId,
        date: closingDate,
        name: `Jurnal Penutup: ${line.accountName}`,
        description: `Penutupan akun pendapatan ${line.accountCode} - ${line.accountName} ke Laba Ditahan`,
        amount: line.balance,
        category: 'FIN',
        account: '',
        debit_account_id: line.accountId,
        credit_account_id: preview.retainedEarningsAccountId,
        is_double_entry: true,
        status: 'posted',
        posted_at: new Date().toISOString(),
        created_by: userId,
        meta: { entry_type: { id: 'closing_entry', label: 'Jurnal Penutup', description: `Periode ${preview.period.start} s/d ${preview.period.end}` } },
      })
      .select('id')
      .single();

    if (error) throw new Error(`Gagal menutup akun ${line.accountCode}: ${error.message}`);
    if (data) createdIds.push(data.id);
  }

  // 2. Close Expense accounts: Dr Laba Ditahan / Cr Expense
  for (const line of preview.expenseLines) {
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        business_id: businessId,
        date: closingDate,
        name: `Jurnal Penutup: ${line.accountName}`,
        description: `Penutupan akun beban ${line.accountCode} - ${line.accountName} ke Laba Ditahan`,
        amount: line.balance,
        category: 'FIN',
        account: '',
        debit_account_id: preview.retainedEarningsAccountId,
        credit_account_id: line.accountId,
        is_double_entry: true,
        status: 'posted',
        posted_at: new Date().toISOString(),
        created_by: userId,
        meta: { entry_type: { id: 'closing_entry', label: 'Jurnal Penutup', description: `Periode ${preview.period.start} s/d ${preview.period.end}` } },
      })
      .select('id')
      .single();

    if (error) throw new Error(`Gagal menutup akun ${line.accountCode}: ${error.message}`);
    if (data) createdIds.push(data.id);
  }

  return createdIds;
}
