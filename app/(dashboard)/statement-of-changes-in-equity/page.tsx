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
    handleExportPDF,
    handleExportExcel,
  } = useStatementOfChangesInEquity();

  const { t } = useLanguage();

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
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Tidak ada bisnis aktif</h3>
          <p className="text-gray-500 dark:text-gray-400">Pilih atau buat bisnis terlebih dahulu</p>
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
          Perubahan Ekuitas
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Statement of Changes in Equity — {activeBusiness.business_name}
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
              Status Tie-out
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
                  {sce.isReconciled ? 'Cocok dengan Neraca' : 'Tidak cocok dengan Neraca'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Saldo akhir ekuitas: {formatCurrency(sce.totalEquityClosing)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — Statement + reconciliation */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Statement of Changes in Equity table */}
          <div className="card-static overflow-x-auto">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">
              Rincian Perubahan Ekuitas
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-3 font-semibold">Komponen</th>
                  <th className="py-2 px-3 font-semibold text-right">Saldo Awal</th>
                  <th className="py-2 px-3 font-semibold text-right">Penambahan</th>
                  <th className="py-2 px-3 font-semibold text-right">Pengurangan</th>
                  <th className="py-2 pl-3 font-semibold text-right">Saldo Akhir</th>
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
                        title="Persentase modal disetor (cap table)"
                      >
                        Modal {o.capitalSharePct.toFixed(2)}%
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
                  <td className="py-2.5 pr-3 font-medium text-gray-800 dark:text-gray-100">Laba Ditahan</td>
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
                  <td className="py-3 pr-3">TOTAL EKUITAS</td>
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
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">
              Rekonsiliasi Dividen
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Hak dividen (porsi × laba periode) dibandingkan dividen aktual yang sudah dibukukan per pemilik.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-3 font-semibold">Pemilik</th>
                  <th className="py-2 px-3 font-semibold text-right">Hak (%)</th>
                  <th className="py-2 px-3 font-semibold text-right">Hak Dividen</th>
                  <th className="py-2 px-3 font-semibold text-right">Aktual</th>
                  <th className="py-2 pl-3 font-semibold text-right">Selisih</th>
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
                        <SignedCurrency value={r.variance} />
                      </td>
                    </tr>
                  );
                })}
                {sce.dividendReconciliation.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-400 dark:text-gray-500">
                      Belum ada akun modal pemilik untuk direkonsiliasi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
              Selisih positif = hak belum dibagikan penuh. Selisih negatif (merah) = dividen melebihi hak.
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
