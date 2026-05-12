import type { Account, TransactionCategory } from '@/types';
import { detectCategory } from './transactionHelpers';

/**
 * Quick Transaction Helper (Model Layer)
 *
 * Resolves a simplified single-account selection into a full double-entry
 * transaction. The user picks ONE account (the "category"), and the system
 * determines:
 *   1. Whether it goes on the debit or credit side
 *   2. What the counter-account is (default cash/bank)
 *   3. The transaction category (EARN, OPEX, VAR, CAPEX, TAX, FIN)
 */

/**
 * Entry mode untuk akun Dividen / Prive:
 *   - 'cashout': bayar langsung dari Kas/Bank   → Dr Dividen / Cr Bank
 *   - 'declare': commitment, belum dibayar       → Dr Dividen / Cr Hutang Dividen
 *   - undefined: bukan akun dividen, abaikan
 */
export type DividendEntryMode = 'cashout' | 'declare';

export interface QuickTransactionInput {
  amount: number;
  selectedAccountId: string;
  name: string;
  date: string;
  notes?: string;
  /** Wajib di-set saat selected account adalah akun is_dividend */
  dividendEntryMode?: DividendEntryMode;
}

export interface ResolvedTransaction {
  date: string;
  category: TransactionCategory;
  name: string;
  description: string;
  amount: number;
  account: string;
  debit_account_id: string;
  credit_account_id: string;
  is_double_entry: boolean;
}

/**
 * Cek apakah akun adalah kas/setara kas — pakai flag DB, fallback ke kode legacy.
 */
function isCashEquivalent(acc: Account): boolean {
  if (acc.is_cash_equivalent === true) return true;
  return acc.account_code === '1100' || acc.account_code === '1200';
}

/**
 * Find the default cash/bank account for counter-entry.
 * Looks for active ASSET sub-accounts flagged is_cash_equivalent.
 * Prefers code 1200 (Bank default) then 1100 (Cash default) untuk
 * konsistensi UX dengan bisnis yang masih pakai CoA default, lalu
 * fallback ke akun kas equivalent pertama berdasarkan sort_order.
 */
export function findDefaultCashAccount(accounts: Account[]): Account | null {
  const cashBankAccounts = accounts
    .filter(
      (acc) =>
        acc.is_active &&
        acc.account_type === 'ASSET' &&
        acc.parent_account_id != null && // Only sub-accounts, not main "Assets" parent
        isCashEquivalent(acc)
    )
    .sort((a, b) => a.sort_order - b.sort_order);

  // Prefer Bank (1200) over Cash (1100) — preserve historical UX default
  const bank = cashBankAccounts.find((acc) => acc.account_code === '1200');
  if (bank) return bank;

  const cash = cashBankAccounts.find((acc) => acc.account_code === '1100');
  if (cash) return cash;

  // Fallback to first available cash-equivalent account (custom codes ok)
  return cashBankAccounts[0] || null;
}

/**
 * True kalau akun ini adalah Dividen / Prive — pakai flag persistent
 * `is_dividend` (set di Chart of Accounts), dengan fallback ke string match
 * untuk akun lama yang belum di-tag.
 */
function isDividendDrawingAccount(acc: Account): boolean {
  if (acc.account_type !== 'EQUITY') return false;
  if (acc.is_dividend) return true;
  const name = acc.account_name.toLowerCase();
  return (
    name.includes('prive') ||
    name.includes('drawing') ||
    name.includes('dividen') ||
    name.includes('dividend')
  );
}

/**
 * Determines the debit and credit side based on the selected account type.
 *
 * Rules:
 * - REVENUE              -> Debit: Cash, Credit: Selected  (money IN)
 * - EXPENSE              -> Debit: Selected, Credit: Cash  (money OUT)
 * - ASSET (non-cash)     -> Debit: Selected, Credit: Cash  (buy asset)
 * - LIABILITY            -> Debit: Cash, Credit: Selected  (receive loan)
 * - EQUITY (capital)     -> Debit: Cash, Credit: Selected  (capital injection)
 * - EQUITY (drawings)    -> Debit: Selected, Credit: Cash  (owner withdrawal)
 */
function resolveDebitCredit(
  selectedAccount: Account,
  cashAccount: Account
): { debitAccountId: string; creditAccountId: string; debitCode: string; creditCode: string } {
  const code = selectedAccount.account_code;
  const type = selectedAccount.account_type;

  // EXPENSE -> money goes OUT from cash
  // EQUITY Drawings/Prive -> money goes OUT from cash
  // ASSET (non-cash like fixed assets) -> money goes OUT from cash (purchase)
  if (
    type === 'EXPENSE' ||
    isDividendDrawingAccount(selectedAccount) ||
    (type === 'ASSET' && !isCashEquivalent(selectedAccount)) // Non-cash assets
  ) {
    return {
      debitAccountId: selectedAccount.id,
      creditAccountId: cashAccount.id,
      debitCode: code,
      creditCode: cashAccount.account_code,
    };
  }

  // REVENUE, LIABILITY, EQUITY (capital/retained) -> money comes IN to cash
  return {
    debitAccountId: cashAccount.id,
    creditAccountId: selectedAccount.id,
    debitCode: cashAccount.account_code,
    creditCode: code,
  };
}

/**
 * Determine a human-readable flow label for the selected account.
 */
export function getFlowLabel(account: Account): string {
  const type = account.account_type;

  if (type === 'REVENUE') return 'Uang Masuk';
  if (type === 'EXPENSE') return 'Uang Keluar';
  if (type === 'LIABILITY') return 'Terima Pinjaman';
  if (isDividendDrawingAccount(account)) return 'Penarikan Prive';
  if (type === 'EQUITY') return 'Suntik Modal';
  if (type === 'ASSET' && !isCashEquivalent(account)) return 'Beli Aset';
  return 'Transaksi';
}

/**
 * Determine whether this is a "money in" or "money out" flow.
 */
export function getFlowDirection(account: Account): 'in' | 'out' {
  const type = account.account_type;

  if (
    type === 'EXPENSE' ||
    isDividendDrawingAccount(account) ||
    (type === 'ASSET' && !isCashEquivalent(account))
  ) {
    return 'out';
  }
  return 'in';
}

/**
 * Returns true kalau akun ini akan memicu popup pilihan declare/cashout
 * di Quick Add maupun complete form. Eksport untuk dipakai UI.
 */
export function isDividendChoiceAccount(account: Account): boolean {
  return isDividendDrawingAccount(account);
}

/**
 * Main resolver: transforms a quick transaction input into a full
 * double-entry transaction ready for the API.
 */
export function resolveQuickTransaction(
  input: QuickTransactionInput,
  accounts: Account[]
): ResolvedTransaction | { error: string } {
  const selectedAccount = accounts.find((acc) => acc.id === input.selectedAccountId);
  if (!selectedAccount) {
    return { error: 'Akun yang dipilih tidak ditemukan' };
  }

  const cashAccount = findDefaultCashAccount(accounts);
  if (!cashAccount) {
    return { error: 'Tidak ada akun kas/bank yang aktif. Silakan buat akun kas/bank terlebih dahulu.' };
  }

  // Don't allow selecting cash/bank as the category (it would be same-account)
  if (selectedAccount.id === cashAccount.id) {
    return { error: 'Tidak bisa memilih akun kas/bank sebagai kategori. Gunakan form lengkap untuk transfer antar rekening.' };
  }

  // === Special path: Dividen / Prive dengan mode 'declare' ===
  // Counter-account = akun Hutang Dividen (LIABILITY dengan is_dividend_payable=TRUE),
  // bukan Kas/Bank.
  if (isDividendDrawingAccount(selectedAccount) && input.dividendEntryMode === 'declare') {
    const payableAccount = accounts.find(
      (acc) => acc.is_active && acc.account_type === 'LIABILITY' && acc.is_dividend_payable
    );
    if (!payableAccount) {
      return {
        error:
          'Akun Hutang Dividen belum tersedia. Silakan buat akun LIABILITY lalu aktifkan toggle "Akun Hutang Dividen" di Chart of Accounts.',
      };
    }

    return {
      date: input.date,
      category: 'FIN',
      name: input.name,
      description: input.notes || selectedAccount.description || selectedAccount.account_name,
      amount: input.amount,
      account: 'Double-entry transaction',
      debit_account_id: selectedAccount.id,
      credit_account_id: payableAccount.id,
      is_double_entry: true,
    };
  }

  const { debitAccountId, creditAccountId, debitCode, creditCode } = resolveDebitCredit(
    selectedAccount,
    cashAccount
  );

  // Find full account objects to check for default_category
  const debitAccount = debitAccountId === selectedAccount.id
    ? selectedAccount
    : cashAccount;
  const creditAccount = creditAccountId === selectedAccount.id
    ? selectedAccount
    : cashAccount;

  const category = detectCategory(debitCode, creditCode, debitAccount, creditAccount);

  return {
    date: input.date,
    category,
    name: input.name,
    description: input.notes || selectedAccount.description || selectedAccount.account_name,
    amount: input.amount,
    account: 'Double-entry transaction',
    debit_account_id: debitAccountId,
    credit_account_id: creditAccountId,
    is_double_entry: true,
  };
}

/**
 * Filter accounts suitable for the quick-add "Kategori" dropdown.
 * Only shows sub-accounts (with parent_account_id), excluding main parent accounts.
 * Excludes Cash (1100) and Bank (1200) since they are used as the automatic counter-account.
 */
/**
 * Returns true if the account is a receivable/advance that should only be used
 * via Full Double-Entry or Multi-line Journal mode, never Quick Transaction.
 *
 * Matches:
 * - account_name containing piutang, receivable, talangan, or advance
 * - ASSET accounts with default_category === 'EARN' (trade receivable)
 */
function isReceivableOrAdvanceAccount(acc: Account): boolean {
  const name = acc.account_name.toLowerCase();
  if (/piutang|receivable|talangan|advance/i.test(name)) return true;
  if (acc.account_type === 'ASSET' && acc.default_category === 'EARN') return true;
  return false;
}

export function getQuickAddAccounts(accounts: Account[]): Account[] {
  // Find the default cash/bank account to exclude it
  const defaultCash = findDefaultCashAccount(accounts);

  return accounts.filter((acc) => {
    if (!acc.is_active) return false;
    if (!acc.parent_account_id) return false; // Exclude main parent accounts (1000, 2000, etc.)
    // Exclude the default counter-account (Cash/Bank) to prevent same-account transactions
    if (defaultCash && acc.id === defaultCash.id) return false;
    // Also exclude every other cash-equivalent ASSET — semuanya berperan sebagai
    // counter-account potensial; user transfer antar-kas pakai Full Double-Entry.
    if (isCashEquivalent(acc)) return false;
    // Exclude receivable/advance accounts — must use Full Double-Entry or Multi-line Journal
    if (isReceivableOrAdvanceAccount(acc)) return false;
    // Exclude Hutang Dividen — hanya boleh dipakai lewat tombol "Bayar Dividen"
    // di TransactionDetailModal, bukan di-pilih langsung sebagai kategori.
    if (acc.is_dividend_payable) return false;
    return true;
  });
}
