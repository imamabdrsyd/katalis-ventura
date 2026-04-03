'use client';

import { Suspense } from 'react';
import { Target, Plus, Trash2, Pencil, Loader2 } from 'lucide-react';
import { useBudget, type BudgetTab } from '@/hooks/useBudget';
import { BudgetSelector } from '@/components/budget/BudgetSelector';
import { BudgetFormModal } from '@/components/budget/BudgetFormModal';
import { BudgetStatusActions } from '@/components/budget/BudgetStatusActions';
import { BudgetKPICards } from '@/components/budget/BudgetKPICards';
import { BudgetInputGrid } from '@/components/budget/BudgetInputGrid';
import { BudgetVsActualChart } from '@/components/budget/BudgetVsActualChart';
import { BudgetTrendChart } from '@/components/budget/BudgetTrendChart';
import { BudgetVarianceTable } from '@/components/budget/BudgetVarianceTable';
import { formatCurrency } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';

const TAB_VALUES: BudgetTab[] = ['overview', 'input', 'variance', 'projection'];

function BudgetForecastPageInner() {
  const { t } = useLanguage();
  const {
    budgets,
    selectedBudget,
    selectedBudgetId,
    relevantAccounts,
    varianceRows,
    summaryKPI,
    projections,
    loading,
    saving,
    error,
    activeTab, setActiveTab,
    showCreateModal, setShowCreateModal,
    showEditModal, setShowEditModal,
    showDeleteConfirm, setShowDeleteConfirm,
    projectionMonths, setProjectionMonths,
    setSelectedBudgetId,
    handleCreateBudget,
    handleUpdateBudget,
    handleSaveBudgetLines,
    handleUpdateStatus,
    handleDeleteBudget,
    canManage,
    activeBusiness,
    generateMonths,
  } = useBudget();

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  // No business
  if (!activeBusiness) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500 dark:text-gray-400">Pilih bisnis terlebih dahulu.</p>
      </div>
    );
  }

  const months = selectedBudget
    ? generateMonths(selectedBudget.start_date, selectedBudget.end_date)
    : [];

  const isLocked = selectedBudget?.status === 'locked';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
            <Target className="w-7 h-7 text-indigo-500 dark:text-indigo-400" />
            Budget & Forecast
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{activeBusiness.business_name}</p>
        </div>

        <div className="flex items-center gap-3">
          {budgets.length > 0 && (
            <BudgetSelector
              budgets={budgets}
              selectedBudgetId={selectedBudgetId}
              onSelect={setSelectedBudgetId}
            />
          )}
          {canManage && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t.budget.createBudget}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* No budgets state */}
      {budgets.length === 0 && (
        <div className="text-center py-20">
          <Target className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">{t.budget.noBudget}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Buat budget pertama untuk mulai merencanakan keuangan bisnis.
          </p>
          {canManage && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t.budget.createBudget} Pertama
            </button>
          )}
        </div>
      )}

      {/* Budget selected */}
      {selectedBudget && (
        <>
          {/* Status bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 px-4 py-3">
            <div className="flex items-center gap-3">
              <BudgetStatusActions
                status={selectedBudget.status}
                canManage={canManage}
                saving={saving}
                onUpdateStatus={handleUpdateStatus}
              />
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {new Date(selectedBudget.start_date).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}
                {' - '}
                {new Date(selectedBudget.end_date).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}
              </span>
            </div>
            {canManage && selectedBudget.status === 'draft' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowEditModal(true)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  title="Edit budget"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  title="Hapus budget"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            {TAB_VALUES.map((value) => {
              const tabLabels: Record<BudgetTab, string> = {
                overview: t.budget.overview,
                input: t.budget.inputBudget,
                variance: t.budget.varianceAnalysis,
                projection: t.budget.projection,
              };
              return (
                <button
                  key={value}
                  onClick={() => setActiveTab(value)}
                  className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === value
                      ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {tabLabels[value]}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div>
            {/* {t.budget.overview} */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {summaryKPI && <BudgetKPICards kpi={summaryKPI} />}

                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">{t.budget.budgetVsActual}</h3>
                  <BudgetVsActualChart rows={varianceRows} />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">{t.budget.projection} Tren</h3>
                  <BudgetTrendChart
                    projections={projections}
                    projectionMonths={projectionMonths}
                    onProjectionMonthsChange={setProjectionMonths}
                  />
                </div>

                {/* Quick highlights */}
                {varianceRows.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Top over-budget */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                      <h4 className="text-xs font-semibold text-red-600 dark:text-red-400 mb-3">{t.budget.overBudget}</h4>
                      {(() => {
                        // Aggregate per account
                        const accountMap = new Map<string, { name: string; code: string; variance: number }>();
                        varianceRows.forEach((r) => {
                          const existing = accountMap.get(r.accountId);
                          if (existing) {
                            existing.variance += r.variance;
                          } else {
                            accountMap.set(r.accountId, { name: r.accountName, code: r.accountCode, variance: r.variance });
                          }
                        });
                        const sorted = Array.from(accountMap.values())
                          .filter((r) => r.variance < 0)
                          .sort((a, b) => a.variance - b.variance)
                          .slice(0, 3);
                        if (sorted.length === 0) {
                          return <p className="text-xs text-gray-400">Tidak ada akun over budget</p>;
                        }
                        return sorted.map((r) => (
                          <div key={r.code} className="flex items-center justify-between py-1.5">
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              <span className="text-xs text-gray-400 mr-1">{r.code}</span>
                              {r.name}
                            </span>
                            <span className="text-sm font-medium text-red-600 dark:text-red-400">
                              {formatCurrency(r.variance)}
                            </span>
                          </div>
                        ));
                      })()}
                    </div>

                    {/* Top under-budget */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                      <h4 className="text-xs font-semibold text-green-600 dark:text-green-400 mb-3">{t.budget.underBudget}</h4>
                      {(() => {
                        const accountMap = new Map<string, { name: string; code: string; variance: number }>();
                        varianceRows.forEach((r) => {
                          const existing = accountMap.get(r.accountId);
                          if (existing) {
                            existing.variance += r.variance;
                          } else {
                            accountMap.set(r.accountId, { name: r.accountName, code: r.accountCode, variance: r.variance });
                          }
                        });
                        const sorted = Array.from(accountMap.values())
                          .filter((r) => r.variance > 0)
                          .sort((a, b) => b.variance - a.variance)
                          .slice(0, 3);
                        if (sorted.length === 0) {
                          return <p className="text-xs text-gray-400">Tidak ada akun under budget</p>;
                        }
                        return sorted.map((r) => (
                          <div key={r.code} className="flex items-center justify-between py-1.5">
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              <span className="text-xs text-gray-400 mr-1">{r.code}</span>
                              {r.name}
                            </span>
                            <span className="text-sm font-medium text-green-600 dark:text-green-400">
                              +{formatCurrency(r.variance)}
                            </span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

                {varianceRows.length === 0 && (
                  <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                    <p className="text-gray-400 dark:text-gray-500">
                      Belum ada data budget. Masukkan target di tab &quot;{t.budget.inputBudget}&quot;.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* {t.budget.inputBudget} */}
            {activeTab === 'input' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                <BudgetInputGrid
                  accounts={relevantAccounts}
                  budgetLines={selectedBudget.lines || []}
                  months={months}
                  readOnly={!canManage || isLocked}
                  saving={saving}
                  onSave={handleSaveBudgetLines}
                />
              </div>
            )}

            {/* Variance Detail */}
            {activeTab === 'variance' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">{t.budget.varianceAnalysis} per Akun</h3>
                <BudgetVarianceTable rows={varianceRows} />
              </div>
            )}

            {/* Projection */}
            {activeTab === 'projection' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">{t.budget.projection} Tren Keuangan</h3>
                  <BudgetTrendChart
                    projections={projections}
                    projectionMonths={projectionMonths}
                    onProjectionMonthsChange={setProjectionMonths}
                  />
                </div>

                {/* Projection summary */}
                {projections.length > 0 && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {(() => {
                      const futureMonths = projections.filter((p) => {
                        const now = new Date();
                        const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                        return p.month > current;
                      });
                      const totalProjectedRevenue = futureMonths.reduce((s, p) => s + p.projected, 0);
                      const totalBudgeted = futureMonths.reduce((s, p) => s + p.budgeted, 0);
                      const avgMonthly = futureMonths.length > 0 ? totalProjectedRevenue / futureMonths.length : 0;

                      const cards = [
                        { label: 'Total {t.budget.projection}', value: formatCurrency(totalProjectedRevenue) },
                        { label: 'Total Budget Target', value: formatCurrency(totalBudgeted) },
                        { label: 'Rata-rata/Bulan', value: formatCurrency(avgMonthly) },
                        { label: 'Periode {t.budget.projection}', value: `${futureMonths.length} bulan` },
                      ];

                      return cards.map((card) => (
                        <div key={card.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{card.label}</span>
                          <div className="text-lg font-bold text-gray-800 dark:text-gray-100 mt-1">{card.value}</div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      <BudgetFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateBudget}
        saving={saving}
      />

      <BudgetFormModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={(data) => handleUpdateBudget(data)}
        saving={saving}
        editBudget={selectedBudget}
      />

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Hapus Budget?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Budget &quot;{selectedBudget?.name}&quot; akan dihapus beserta semua data budget lines-nya. Tindakan ini tidak bisa dibatalkan.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteBudget}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BudgetForecastPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    }>
      <BudgetForecastPageInner />
    </Suspense>
  );
}
