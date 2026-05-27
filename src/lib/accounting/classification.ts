/**
 * Account Classification Helpers
 *
 * Pusat logika klasifikasi akun untuk piutang usaha (trade receivable) dan
 * hutang operasional (operating payable). Dipakai oleh:
 *   - classifyCashFlow() di calculations.ts (IAS 7 / PSAK 2)
 *   - receivableSettlement.ts (deteksi pelunasan piutang)
 *   - useArApAging.ts (laporan aging)
 *
 * Strategi: flag-first dengan heuristic fallback.
 *   1. Jika kolom DB is_trade_receivable / is_operating_payable di-set (TRUE/FALSE
 *      eksplisit), gunakan itu. Ini diisi oleh migration 085 saat backfill atau
 *      saat user toggle di AccountForm.
 *   2. Jika flag tidak ada (data lama sebelum migration, atau akun yang belum
 *      di-classify), fallback ke heuristic berbasis default_category + nama akun.
 *
 * Ini memastikan:
 *   - Bisnis yang pakai nama akun standar tetap jalan tanpa migration data
 *   - Bisnis yang pakai nama akun custom ("Tagihan Pelanggan", "Outstanding
 *     Bills") bisa ditandai eksplisit lewat UI toggle → tetap ter-klasifikasi
 *     dengan benar di Cash Flow Statement
 */

import type { Account } from '@/types';

// ─────────────────── Patterns (single source of truth) ───────────────────

const TRADE_RECEIVABLE_NAME_PATTERN =
  /piutang usaha|piutang dagang|piutang pelanggan|trade receivable|account receivable|accounts receivable/i;

const ADVANCE_RECEIVABLE_NAME_PATTERN = /talangan|advance/i;

const OPERATING_PAYABLE_NAME_PATTERN =
  /hutang usaha|utang usaha|hutang dagang|utang dagang|trade payable|account payable|accounts payable|accrued/i;

const FINANCING_LIABILITY_NAME_PATTERN =
  /pinjaman|loan|kredit bank|hutang bank|utang bank/i;

// ─────────────────── Trade Receivable ───────────────────

/**
 * Returns true if the given ASSET account represents a trade receivable
 * (piutang usaha) — cash received from customers, classified as Operating
 * Activity per IAS 7.14.
 *
 * Excludes advances/talangan/loan receivable — those are Financing activity.
 *
 * @param account The account to classify (must be ASSET type)
 */
export function isTradeReceivableAccount(account: Account | null | undefined): boolean {
  if (!account) return false;
  if (account.account_type !== 'ASSET') return false;

  // Flag-first: if explicitly set TRUE in DB, trust it
  if (account.is_trade_receivable === true) return true;

  // Heuristic fallback for accounts without backfilled flag.
  // Talangan/advance are explicitly excluded (they go to Financing).
  const name = (account.account_name || '').toLowerCase();

  if (account.default_category === 'FIN') {
    // FIN-category ASSETs: only trade receivable if name says so AND not talangan
    if (ADVANCE_RECEIVABLE_NAME_PATTERN.test(name)) return false;
    return TRADE_RECEIVABLE_NAME_PATTERN.test(name);
  }

  if (ADVANCE_RECEIVABLE_NAME_PATTERN.test(name)) return false;

  // EARN-category ASSETs → trade receivable
  if (account.default_category === 'EARN') return true;

  // Name-based fallback
  return TRADE_RECEIVABLE_NAME_PATTERN.test(name);
}

/**
 * Returns true if the given ASSET account represents a non-trade receivable
 * such as talangan, advance, or loan receivable. These are Financing activity
 * (cash paid on behalf of others, to be reimbursed).
 */
export function isAdvanceReceivableAccount(account: Account | null | undefined): boolean {
  if (!account) return false;
  if (account.account_type !== 'ASSET') return false;
  // If flagged as trade receivable, it's NOT advance
  if (account.is_trade_receivable === true) return false;

  const name = (account.account_name || '').toLowerCase();
  if (ADVANCE_RECEIVABLE_NAME_PATTERN.test(name)) return true;
  if (account.default_category === 'FIN') {
    // FIN-category ASSET without trade-receivable name → advance
    return !TRADE_RECEIVABLE_NAME_PATTERN.test(name);
  }
  return false;
}

/**
 * Returns true if the account is ANY kind of receivable (trade or advance).
 * Useful for the broader settlement detection (isReceivableTransaction).
 */
export function isAnyReceivableAccount(account: Account | null | undefined): boolean {
  return isTradeReceivableAccount(account) || isAdvanceReceivableAccount(account);
}

// ─────────────────── Operating Payable ───────────────────

/**
 * Returns true if the given LIABILITY account represents an operating payable
 * (hutang usaha, accrued expenses) — cash paid to suppliers/operating
 * obligations, classified as Operating Activity per IAS 7.14.
 *
 * Excludes bank loans / long-term debt — those are Financing activity.
 *
 * @param account The account to classify (must be LIABILITY type)
 */
export function isOperatingPayableAccount(account: Account | null | undefined): boolean {
  if (!account) return false;
  if (account.account_type !== 'LIABILITY') return false;

  // Flag-first: if explicitly set TRUE in DB, trust it
  if (account.is_operating_payable === true) return true;

  // Heuristic fallback for accounts without backfilled flag.
  const name = (account.account_name || '').toLowerCase();
  const cat = account.default_category;

  // Explicit financing-debt names override category
  if (cat === 'FIN' && FINANCING_LIABILITY_NAME_PATTERN.test(name)) return false;

  // Operating expense categories → operating payable
  if (cat === 'OPEX' || cat === 'VAR' || cat === 'TAX') return true;

  // Name-based fallback
  return OPERATING_PAYABLE_NAME_PATTERN.test(name);
}
