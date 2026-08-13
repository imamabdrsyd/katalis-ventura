'use client';

/**
 * ShareholderEntitlementPanel
 *
 * Ditampilkan di Journal Entry saat user memilih "Tarik Dividen" — SEBELUM
 * penarikan dicatat. Isinya hak bagi hasil tiap pemilik untuk tahun berjalan:
 * persentase, nominal hak, yang sudah ditarik, dan sisa yang masih boleh
 * ditarik.
 *
 * Tujuannya menutup celah kepatuhan: tanpa panel ini user menarik dividen
 * berdasarkan ingatan, sementara porsi tiap pemilik sudah disepakati di
 * `accounts.profit_share_pct`. Penarikan melebihi hak baru ketahuan nanti di
 * halaman Statement of Changes in Equity — setelah uangnya keluar.
 *
 * Angkanya BUKAN hitungan baru: dipakai `calculateStatementOfChangesInEquity()`
 * yang sama persis dengan halaman SCE, jadi tidak mungkin dua halaman ini
 * bercerita beda.
 */

import { useMemo } from 'react';
import type { Account, Transaction } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { calculateStatementOfChangesInEquity } from '@/lib/calculations';
import { useLanguage } from '@/context/LanguageContext';
import { Scale, AlertTriangle } from 'lucide-react';

interface ShareholderEntitlementPanelProps {
  transactions: Transaction[];
  accounts: Account[];
  /** capital_investment bisnis — argumen yang sama dengan halaman SCE */
  capital?: number;
  /**
   * Dipanggil saat user mengklik baris pemilik. Parent mem-prefill form
   * penarikan: akun debit = akun dividen pemilik itu, nominal = sisa haknya.
   */
  onPickOwner?: (input: {
    stockAccountId: string;
    ownerName: string;
    dividendAccountId: string | null;
    remaining: number;
  }) => void;
}

export function ShareholderEntitlementPanel({
  transactions,
  accounts,
  capital = 0,
  onPickOwner,
}: ShareholderEntitlementPanelProps) {
  const { t } = useLanguage();
  const te = t.journalEntry.entitlement;

  // Periode: tahun berjalan. Bagi hasil disepakati per tahun buku, jadi hak
  // yang relevan saat menarik hari ini adalah laba tahun ini.
  const { startDate, endDate, year } = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    return {
      startDate: `${y}-01-01`,
      endDate: now.toISOString().slice(0, 10),
      year: y,
    };
  }, []);

  const sce = useMemo(
    () => calculateStatementOfChangesInEquity(transactions, startDate, endDate, capital, accounts),
    [transactions, startDate, endDate, capital, accounts]
  );

  /** Akun dividen milik seorang pemilik — ditandai lewat owner_stock_account_id. */
  const dividendAccountFor = (stockAccountId: string): Account | null =>
    accounts.find((a) => a.is_dividend === true && a.owner_stock_account_id === stockAccountId) ??
    null;

  const rows = useMemo(() => {
    const pctByAccount = new Map(sce.owners.map((o) => [o.stockAccountId, o]));
    return sce.dividendReconciliation
      .map((r) => {
        const owner = pctByAccount.get(r.stockAccountId);
        return {
          ...r,
          displayName: owner?.contactName || r.ownerName,
          profitSharePct: owner?.profitSharePct ?? 0,
          profitShareIsExplicit: owner?.profitShareIsExplicit ?? false,
        };
      })
      .sort((a, b) => b.profitSharePct - a.profitSharePct);
  }, [sce]);

  if (rows.length === 0) return null;

  return (
    <div className="card-static space-y-3">
      <div className="flex items-start gap-2">
        <Scale className="w-4 h-4 mt-0.5 text-gray-400 dark:text-gray-500 shrink-0" />
        <div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
            {te.title.replace('{year}', String(year))}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {te.subtitle.replace('{netIncome}', formatCurrency(sce.netIncome))}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-200 dark:border-gray-700">
              <th className="py-2 pr-3 font-semibold text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {te.owner}
              </th>
              <th className="py-2 px-3 font-semibold text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 text-right">
                {te.share}
              </th>
              <th className="py-2 px-3 font-semibold text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 text-right">
                {te.entitled}
              </th>
              <th className="py-2 px-3 font-semibold text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 text-right">
                {te.taken}
              </th>
              <th className="py-2 pl-3 font-semibold text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 text-right">
                {te.remaining}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const overdrawn = r.variance < 0;
              const remaining = Math.max(0, r.variance);
              const clickable = !!onPickOwner && remaining > 0;

              return (
                <tr
                  key={r.stockAccountId}
                  onClick={
                    clickable
                      ? () =>
                          onPickOwner!({
                            stockAccountId: r.stockAccountId,
                            ownerName: r.displayName,
                            dividendAccountId: dividendAccountFor(r.stockAccountId)?.id ?? null,
                            remaining,
                          })
                      : undefined
                  }
                  className={`border-b border-gray-100 dark:border-gray-800 last:border-0 ${
                    clickable ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50' : ''
                  }`}
                >
                  <td className="py-2.5 pr-3">
                    <p className="font-medium text-gray-800 dark:text-gray-100">{r.displayName}</p>
                    {!r.profitShareIsExplicit && (
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">
                        {te.pctFromCapital}
                      </p>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-gray-700 dark:text-gray-200">
                    {r.profitSharePct.toFixed(r.profitSharePct % 1 === 0 ? 0 : 2)}%
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-gray-700 dark:text-gray-200">
                    {formatCurrency(r.entitled)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-gray-700 dark:text-gray-200">
                    {formatCurrency(r.actual)}
                    {r.declaredOutstanding > 0 && (
                      <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                        {te.stillPayable.replace(
                          '{amount}',
                          formatCurrency(r.declaredOutstanding)
                        )}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pl-3 text-right tabular-nums font-semibold">
                    {overdrawn ? (
                      <span className="text-red-500 dark:text-red-400">
                        {te.overdrawn.replace('{amount}', formatCurrency(Math.abs(r.variance)))}
                      </span>
                    ) : (
                      <span className="text-gray-800 dark:text-gray-100">
                        {formatCurrency(remaining)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sce.netIncome <= 0 && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300">{te.noProfitWarning}</p>
        </div>
      )}

      <p className="text-[11px] text-gray-400 dark:text-gray-500">{te.footnote}</p>
    </div>
  );
}
