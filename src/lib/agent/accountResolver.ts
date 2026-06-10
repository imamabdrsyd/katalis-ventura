/**
 * Account resolver untuk AXION Agent.
 *
 * Strategi (berurutan):
 * 1. Cari by kode akun exact (4200, 5900, 1200, 1100)
 * 2. Cari by default_category + account_type
 * 3. Cari by kata kunci nama akun
 * 4. Fallback: kembalikan null → LLM akan tanya user
 */

import type { Account } from '@/types';

export interface ChannelAccountConfig {
  /** Akun kredit untuk pendapatan (misal: 4200 Short-term Rent) */
  revenueAccountId: string;
  /** Akun debit untuk komisi/fee platform (misal: 5900 Komisi Platform) */
  commissionAccountId: string | null;
  /** Akun debit untuk penerimaan kas/bank (misal: 1200 Bank) */
  bankAccountId: string;
}

export interface AccountResolveResult {
  config: ChannelAccountConfig | null;
  /** Akun yang tidak ditemukan dan perlu dikonfirmasi user */
  missingAccounts: string[];
  /** Apakah resolver yakin (tidak perlu konfirmasi) */
  confident: boolean;
}

// Kode akun default Hillside / bisnis short_term_rental
const AIRBNB_PREFERRED_CODES = {
  revenue: ['4200', '4100'],
  commission: ['5900', '5800', '5100'],
  bank: ['1200', '1100'],
};

const AIRBNB_REVENUE_KEYWORDS = ['sewa', 'rental', 'airbnb', 'pendapatan sewa', 'pendapatan jasa', 'revenue'];
const AIRBNB_COMMISSION_KEYWORDS = ['komisi', 'platform fee', 'service fee', 'biaya platform', 'admin'];
const BANK_KEYWORDS = ['bank', 'rekening', 'tabungan', 'giro'];
const CASH_KEYWORDS = ['kas', 'cash', 'tunai'];

function findByCode(accounts: Account[], codes: string[]): Account | undefined {
  for (const code of codes) {
    const found = accounts.find(a => a.account_code === code && a.is_active);
    if (found) return found;
  }
  return undefined;
}

function findByKeywords(accounts: Account[], keywords: string[], type: string): Account | undefined {
  const lower = accounts
    .filter(a => a.account_type === type && a.is_active)
    .find(a => {
      const name = a.account_name.toLowerCase();
      return keywords.some(kw => name.includes(kw));
    });
  return lower;
}

export function resolveAirbnbAccounts(accounts: Account[]): AccountResolveResult {
  const missingAccounts: string[] = [];

  // 1. Revenue account (CREDIT)
  let revenueAccount =
    findByCode(accounts, AIRBNB_PREFERRED_CODES.revenue) ??
    findByKeywords(accounts, AIRBNB_REVENUE_KEYWORDS, 'REVENUE') ??
    accounts.find(a => a.account_type === 'REVENUE' && a.is_active && a.default_category === 'EARN');

  if (!revenueAccount) missingAccounts.push('akun Pendapatan Sewa (Revenue)');

  // 2. Commission account (DEBIT) — opsional, kalau tidak ada langsung masuk ke revenue bersih
  let commissionAccount =
    findByCode(accounts, AIRBNB_PREFERRED_CODES.commission) ??
    findByKeywords(accounts, AIRBNB_COMMISSION_KEYWORDS, 'EXPENSE');

  // Commission tidak wajib — kalau tidak ada, service fee digabung ke revenue (net entry)

  // 3. Bank account (DEBIT)
  let bankAccount =
    findByCode(accounts, AIRBNB_PREFERRED_CODES.bank) ??
    accounts.find(a =>
      a.account_type === 'ASSET' &&
      a.is_active &&
      (a.is_cash_equivalent ?? false) &&
      BANK_KEYWORDS.some(kw => a.account_name.toLowerCase().includes(kw))
    ) ??
    accounts.find(a =>
      a.account_type === 'ASSET' &&
      a.is_active &&
      (a.is_cash_equivalent ?? false) &&
      CASH_KEYWORDS.some(kw => a.account_name.toLowerCase().includes(kw))
    ) ??
    accounts.find(a => a.account_type === 'ASSET' && a.is_active && (a.is_cash_equivalent ?? false));

  if (!bankAccount) missingAccounts.push('akun Bank/Kas (Asset)');

  if (!revenueAccount || !bankAccount) {
    return { config: null, missingAccounts, confident: false };
  }

  return {
    config: {
      revenueAccountId: revenueAccount.id,
      commissionAccountId: commissionAccount?.id ?? null,
      bankAccountId: bankAccount.id,
    },
    missingAccounts,
    confident: true,
  };
}

// ── TikTok Shop / Tokopedia (penjualan produk marketplace) ──────────────
// Bisnis produk/dagang: pendapatan = 4100 Pendapatan Penjualan, kas masuk ke
// Kas/Bank. Tidak ada akun komisi (CSV order tidak memuat komisi platform).
const MARKETPLACE_PREFERRED_CODES = {
  revenue: ['4100', '4000'],
  // Marketplace umumnya cair ke rekening bank; utamakan Bank lalu Kas.
  bank: ['1200', '1100'],
};

const MARKETPLACE_REVENUE_KEYWORDS = ['penjualan', 'pendapatan penjualan', 'sales', 'pendapatan', 'revenue'];

/**
 * Resolve akun untuk impor penjualan TikTok Shop / Tokopedia.
 * Jurnal hanya 2-baris (Dr Kas/Bank, Cr Pendapatan) — commissionAccount selalu null.
 */
export function resolveMarketplaceAccounts(accounts: Account[]): AccountResolveResult {
  const missingAccounts: string[] = [];

  const revenueAccount =
    findByCode(accounts, MARKETPLACE_PREFERRED_CODES.revenue) ??
    accounts.find(a => a.account_type === 'REVENUE' && a.is_active && a.default_category === 'EARN') ??
    findByKeywords(accounts, MARKETPLACE_REVENUE_KEYWORDS, 'REVENUE');

  if (!revenueAccount) missingAccounts.push('akun Pendapatan Penjualan (Revenue)');

  const bankAccount =
    findByCode(accounts, MARKETPLACE_PREFERRED_CODES.bank) ??
    accounts.find(a =>
      a.account_type === 'ASSET' &&
      a.is_active &&
      (a.is_cash_equivalent ?? false) &&
      BANK_KEYWORDS.some(kw => a.account_name.toLowerCase().includes(kw))
    ) ??
    accounts.find(a =>
      a.account_type === 'ASSET' &&
      a.is_active &&
      (a.is_cash_equivalent ?? false) &&
      CASH_KEYWORDS.some(kw => a.account_name.toLowerCase().includes(kw))
    ) ??
    accounts.find(a => a.account_type === 'ASSET' && a.is_active && (a.is_cash_equivalent ?? false));

  if (!bankAccount) missingAccounts.push('akun Kas/Bank (Asset)');

  if (!revenueAccount || !bankAccount) {
    return { config: null, missingAccounts, confident: false };
  }

  return {
    config: {
      revenueAccountId: revenueAccount.id,
      commissionAccountId: null,
      bankAccountId: bankAccount.id,
    },
    missingAccounts,
    confident: true,
  };
}

/**
 * Cari akun Piutang Usaha (untuk impor marketplace mode 'receivable' — dana order
 * belum cair ke bank). Prioritas: flag is_trade_receivable → kode 1130/1140 → keyword.
 * Return null bila bisnis tidak punya akun piutang (caller fallback ke bank).
 */
export function resolveReceivableAccount(accounts: Account[]): Account | null {
  const byFlag = accounts.find(a => a.account_type === 'ASSET' && a.is_active && a.is_trade_receivable);
  if (byFlag) return byFlag;

  const byCode = findByCode(accounts, ['1130', '1140', '1150']);
  if (byCode && byCode.account_type === 'ASSET') return byCode;

  const byKeyword = accounts.find(a =>
    a.account_type === 'ASSET' && a.is_active &&
    ['piutang', 'receivable'].some(kw => a.account_name.toLowerCase().includes(kw))
  );
  return byKeyword ?? null;
}

export interface ResolvedAccountSummary {
  revenueAccount: Account;
  commissionAccount: Account | null;
  bankAccount: Account;
}

export function describeResolvedAccounts(
  accounts: Account[],
  config: ChannelAccountConfig
): ResolvedAccountSummary | null {
  const rev = accounts.find(a => a.id === config.revenueAccountId);
  const com = config.commissionAccountId
    ? accounts.find(a => a.id === config.commissionAccountId) ?? null
    : null;
  const bank = accounts.find(a => a.id === config.bankAccountId);
  if (!rev || !bank) return null;
  return { revenueAccount: rev, commissionAccount: com, bankAccount: bank };
}
