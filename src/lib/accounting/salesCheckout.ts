/**
 * Resolver akun untuk checkout penjualan (pola Quick Entry) — dipakai bersama
 * oleh kasir POS (`useCashier`) dan booking kalender (`useCalendar`/`bookings` API).
 *
 * Saat menerima pembayaran EARN yang langsung lunas, sistem tak meminta user
 * memilih akun; akun Kas/Bank & Pendapatan di-resolve otomatis di sini agar
 * konsisten antar hub.
 */

import type { Account } from '@/types';

export type PaymentMethod = 'cash' | 'qris';

/** Akun kas/bank counter sesuai metode: Tunai→kode 1100, QRIS→kode 1200. */
export function resolveCashAccount(accounts: Account[], method: PaymentMethod): Account | null {
  const preferredCode = method === 'cash' ? '1100' : '1200';
  const fallbackCode = method === 'cash' ? '1200' : '1100';
  const isCashEq = (a: Account) =>
    a.is_active &&
    a.account_type === 'ASSET' &&
    (a.is_cash_equivalent === true || a.account_code === '1100' || a.account_code === '1200');

  const pool = accounts.filter(isCashEq);
  return (
    pool.find((a) => a.account_code === preferredCode) ??
    pool.find((a) => a.account_code === fallbackCode) ??
    pool[0] ??
    null
  );
}

/** Akun pendapatan default bila item tak punya revenue_account_id (prefer 4100). */
export function resolveDefaultRevenueAccount(accounts: Account[]): Account | null {
  const revenue = accounts.filter(
    (a) => a.is_active && a.account_type === 'REVENUE' && a.parent_account_id != null
  );
  return revenue.find((a) => a.account_code === '4100') ?? revenue[0] ?? null;
}
