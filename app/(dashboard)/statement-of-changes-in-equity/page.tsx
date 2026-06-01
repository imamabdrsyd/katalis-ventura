'use client';

import { Suspense } from 'react';
import { Building2, GitBranch, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useStatementOfChangesInEquity } from '@/hooks/useStatementOfChangesInEquity';
import { useLanguage } from '@/context/LanguageContext';
import { formatCurrency } from '@/lib/utils';
import { PeriodFilterCard } from '@/components/reports/PeriodFilterCard';

function SignedCurrency({ value, parens = false }: { value: number; parens?: boolean }) {
  if (value === 0) return <span className="text-gray-400 dark:text-gray-500">-</span>;
  if (value < 0 || parens) {
    return <span className="text-red-500 dark:text-red-400">({formatCurrency(Math.abs(value))})</span>;
  }
  return <span>{formatCurrency(value)}</span>;
}

function PeriodBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
      {label || '-'}
    </span>
  );
}

function SettledBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
      {label}
    </span>
  );
}

function DeclaredBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
      {label}
    </span>
  );
}

function SCEPageInner() {
  const {
    activeBusiness,
    loading,
    period,
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    handlePeriodChange,
    sce,
    periodDisplayLabel,
    handleExportPDF,
    handleExportExcel,
  } = useStatementOfChangesInEquity();

  const { t } = useLanguage();
  const text = t.changesInEquityPage;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!activeBusiness) {
    return (
      <div className="p-8">
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <div className="flex justify-center mb-4"><Building2 className="w-10 h-10 text-gray-400" /></div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">{text.noActiveBusiness}</h3>
          <p className="text-gray-500 dark:text-gray-400">{text.selectBusinessFirst}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
          <GitBranch className="w-7 h-7 text-primary-500 dark:text-primary-400" />
          {text.title}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {text.reportTitle.replace('{name}', activeBusiness.business_name)}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* LEFT — Filter + status */}
        <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 space-y-6">
          <PeriodFilterCard
            period={period}
            startDate={startDate}
            endDate={endDate}
            onPeriodChange={handlePeriodChange}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onExportPDF={handleExportPDF}
            onExportExcel={handleExportExcel}
            months={t.dashboard.months}
          />

          {/* Reconciliation status with Balance Sheet */}
          <div className="card-static space-y-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
              {text.statusTieOut}
            </h4>
            <div className={`flex items-start gap-2.5 rounded-lg p-3 ${
              sce.isReconciled
                ? 'bg-emerald-50 dark:bg-emerald-900/20'
                : 'bg-amber-50 dark:bg-amber-900/20'
            }`}>
              {sce.isReconciled ? (
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4.5 h-4.5 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="text-sm">
                <p className={`font-medium ${
                  sce.isReconciled
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-amber-700 dark:text-amber-300'
                }`}>
                  {sce.isReconciled ? text.reconciledWithBalanceSheet : text.notReconciledWithBalanceSheet}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {text.endingEquityBalance.replace('{amount}', formatCurrency(sce.totalEquityClosing))}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — Statement + reconciliation */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Statement of Changes in Equity table */}
          <div className="card-static overflow-x-auto">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                {text.detailsTitle}
              </h3>
              <PeriodBadge label={periodDisplayLabel} />
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-3 font-semibold">{text.component}</th>
                  <th className="py-2 px-3 font-semibold text-right">{text.openingBalance}</th>
                  <th className="py-2 px-3 font-semibold text-right">{text.additions}</th>
                  <th className="py-2 px-3 font-semibold text-right">{text.deductions}</th>
                  <th className="py-2 pl-3 font-semibold text-right">{text.closingBalance}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {/* Modal per pemilik */}
                {sce.owners.map((o) => (
                  <tr key={o.stockAccountId} className="text-gray-700 dark:text-gray-300">
                    <td className="py-2.5 pr-3">
                      <span className="font-medium text-gray-800 dark:text-gray-100">
                        {o.contactName ?? o.ownerName}
                      </span>
                      <span
                        className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        title={text.capitalShareTitle}
                      >
                        {text.capitalBadgeLabel} {o.capitalSharePct.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{formatCurrency(o.capitalOpening)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums"><SignedCurrency value={o.capitalAdditions} /></td>
                    <td className="py-2.5 px-3 text-right tabular-nums"><SignedCurrency value={-o.capitalWithdrawals} /></td>
                    <td className="py-2.5 pl-3 text-right tabular-nums font-medium text-gray-800 dark:text-gray-100">
                      {formatCurrency(o.capitalClosing)}
                    </td>
                  </tr>
                ))}

                {/* Laba ditahan */}
                <tr className="text-gray-700 dark:text-gray-300">
                  <td className="py-2.5 pr-3 font-medium text-gray-800 dark:text-gray-100">{text.retainedEarnings}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{formatCurrency(sce.retainedOpening)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    <SignedCurrency value={sce.netIncome > 0 ? sce.netIncome : 0} />
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    <SignedCurrency value={sce.netIncome < 0 ? sce.netIncome : -sce.dividendsDeclared} />
                  </td>
                  <td className="py-2.5 pl-3 text-right tabular-nums font-medium text-gray-800 dark:text-gray-100">
                    {formatCurrency(sce.retainedClosing)}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 dark:border-gray-600 font-semibold text-gray-900 dark:text-gray-100">
                  <td className="py-3 pr-3">{text.totalEquity}</td>
                  <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(sce.totalEquityOpening)}</td>
                  <td className="py-3 px-3" />
                  <td className="py-3 px-3" />
                  <td className="py-3 pl-3 text-right tabular-nums">{formatCurrency(sce.totalEquityClosing)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Dividend reconciliation */}
          <div className="card-static overflow-x-auto">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">
                  {text.dividendReconciliation}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {text.dividendReconciliationDesc}
                </p>
              </div>
              <PeriodBadge label={periodDisplayLabel} />
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-3 font-semibold">{text.owner}</th>
                  <th className="py-2 px-3 font-semibold text-right">{text.entitlementPct}</th>
                  <th className="py-2 px-3 font-semibold text-right">{text.dividendEntitlement}</th>
                  <th className="py-2 px-3 font-semibold text-right">{text.actual}</th>
                  <th className="py-2 pl-3 font-semibold text-right">{text.difference}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {sce.dividendReconciliation.map((r) => {
                  const owner = sce.owners.find((o) => o.stockAccountId === r.stockAccountId);
                  return (
                    <tr key={r.stockAccountId} className="text-gray-700 dark:text-gray-300">
                      <td className="py-2.5 pr-3 font-medium text-gray-800 dark:text-gray-100">
                        {owner?.contactName ?? r.ownerName}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{owner?.profitSharePct.toFixed(2) ?? '0.00'}%</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{formatCurrency(r.entitled)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{formatCurrency(r.actual)}</td>
                      <td className="py-2.5 pl-3 text-right tabular-nums font-medium">
                        {r.variance === 0 ? (
                          r.declaredOutstanding > 0 ? (
                            <DeclaredBadge label={text.declaredBadge} />
                          ) : (
                            <SettledBadge label={text.settledBadge} />
                          )
                        ) : (
                          <SignedCurrency value={r.variance} />
                        )}
                      </td>
                    </tr>
                  );
                })}
                {sce.dividendReconciliation.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-400 dark:text-gray-500">
                      {text.noOwnerCapitalAccounts}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
              {text.varianceNote}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StatementOfChangesInEquityPage() {
  return (
    <Suspense fallback={
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SCEPageInner />
    </Suspense>
  );
}
