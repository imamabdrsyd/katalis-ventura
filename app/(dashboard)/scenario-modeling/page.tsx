'use client';

import { useState, Suspense } from 'react';
import { Calendar, TrendingUp, TrendingDown, Minus, FlaskConical, BarChart3, SlidersHorizontal, LineChart, Building2 } from 'lucide-react';
import { useScenarioModeling, type ScenarioResult } from '@/hooks/useScenarioModeling';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReportSkeleton } from '@/components/ui/PageSkeleton';
import { formatCurrency } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import type { Period } from '@/hooks/useReportData';

function AssumptionSlider({
  label,
  value,
  onChange,
  min = -50,
  max = 50,
  step = 1,
  suffix = '%',
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm text-gray-600 dark:text-gray-400">{label}</label>
        <span className={`text-sm font-semibold tabular-nums ${
          value > 0 ? 'text-green-600 dark:text-green-400' :
          value < 0 ? 'text-red-500 dark:text-red-400' :
          'text-gray-600 dark:text-gray-400'
        }`}>
          {value > 0 ? '+' : ''}{value}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
      />
    </div>
  );
}

function ScenarioCard({
  scenario,
  baseline,
  color,
  icon: Icon,
}: {
  scenario: ScenarioResult;
  baseline: ScenarioResult;
  color: 'green' | 'red' | 'blue' | 'gray';
  icon: React.ElementType;
}) {
  const { t } = useLanguage();
  const colorMap = {
    green: {
      bg: 'bg-white dark:bg-gray-800',
      border: 'border-gray-200 dark:border-gray-700',
      title: 'text-emerald-800 dark:text-emerald-300',
      accent: 'text-emerald-500 dark:text-emerald-400',
      iconBg: 'bg-emerald-50 dark:bg-emerald-900/40',
    },
    red: {
      bg: 'bg-white dark:bg-gray-800',
      border: 'border-gray-200 dark:border-gray-700',
      title: 'text-red-800 dark:text-red-300',
      accent: 'text-red-500 dark:text-red-400',
      iconBg: 'bg-red-50 dark:bg-red-900/40',
    },
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      title: 'text-blue-800 dark:text-blue-300',
      accent: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    },
    gray: {
      bg: 'bg-gray-50 dark:bg-gray-800/50',
      border: 'border-gray-200 dark:border-gray-700',
      title: 'text-gray-800 dark:text-gray-200',
      accent: 'text-gray-600 dark:text-gray-400',
      iconBg: 'bg-gray-100 dark:bg-gray-700',
    },
  };

  const c = colorMap[color];
  const netDiff = scenario.netIncome - baseline.netIncome;
  const netDiffPct = baseline.netIncome !== 0 ? (netDiff / Math.abs(baseline.netIncome)) * 100 : 0;

  return (
    <div className={`card ${c.bg} ${c.border}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${c.accent}`} />
        </div>
        <div>
          <h3 className={`font-bold ${c.title}`}>{scenario.label}</h3>
          {color !== 'gray' && (
            <span className={`text-xs font-medium ${netDiff >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
              {netDiff >= 0 ? '+' : ''}{formatCurrency(netDiff)} ({netDiffPct >= 0 ? '+' : ''}{netDiffPct.toFixed(1)}%)
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2.5">
        <Row label={t.scenario.revenue} value={scenario.revenue} />
        <Row label={t.scenario.cogs} value={-scenario.cogs} negative />
        <Divider />
        <Row label={t.scenario.grossProfit} value={scenario.grossProfit} bold />
        <Row label={t.scenario.opexLabel} value={-scenario.opex} negative />
        {scenario.depreciation > 0 && (
          <Row label={t.scenario.depreciation} value={-scenario.depreciation} negative />
        )}
        <Divider />
        <Row label={t.scenario.operatingIncome} value={scenario.operatingIncome} bold />
        <Row label={t.scenario.interest} value={-scenario.interest} negative />
        <Row label={t.scenario.tax} value={-scenario.tax} negative />
        <Divider />
        <div className={`flex justify-between items-center pt-1 ${
          scenario.netIncome >= 0
            ? 'text-green-700 dark:text-green-400'
            : 'text-red-500 dark:text-red-400'
        }`}>
          <span className="font-bold">{t.scenario.netIncome}</span>
          <span className="font-bold text-lg">{formatCurrency(scenario.netIncome)}</span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-2">
        <MarginBadge label={t.scenario.marginGross} value={scenario.grossMargin} />
        <MarginBadge label={t.scenario.marginOperating} value={scenario.operatingMargin} />
        <MarginBadge label={t.scenario.marginNet} value={scenario.netMargin} />
      </div>
    </div>
  );
}

function Row({ label, value, bold, negative }: { label: string; value: number; bold?: boolean; negative?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className={`text-gray-600 dark:text-gray-400 ${bold ? 'font-semibold text-gray-800 dark:text-gray-200' : ''}`}>{label}</span>
      <span className={`tabular-nums ${
        bold ? 'font-semibold text-gray-800 dark:text-gray-200' :
        negative ? 'text-red-500 dark:text-red-400' :
        'text-gray-800 dark:text-gray-200'
      }`}>
        {negative && value < 0 ? `(${formatCurrency(Math.abs(value))})` : formatCurrency(value)}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-gray-200 dark:border-gray-700" />;
}

function MarginBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">{label}</p>
      <p className={`text-sm font-bold ${
        value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
      }`}>
        {value.toFixed(1)}%
      </p>
    </div>
  );
}

function ProjectionBar({ projections }: { projections: { month: string; revenue: number; netIncome: number; cumulativeNetIncome: number }[] }) {
  const { t } = useLanguage();
  if (projections.length === 0) {
    return (
      <EmptyState size="sm" icon={LineChart} title={t.scenario.noProjectionData} />
    );
  }

  const maxRevenue = Math.max(...projections.map(p => Math.abs(p.revenue)));
  const maxNet = Math.max(...projections.map(p => Math.abs(p.netIncome)));
  const maxVal = Math.max(maxRevenue, maxNet, 1);

  return (
    <div className="space-y-3">
      {projections.map((p) => (
        <div key={p.month} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-400 font-medium w-20">{p.month}</span>
            <div className="flex gap-4 text-[11px]">
              <span className="text-blue-600 dark:text-blue-400">{t.scenario.revShort}: {formatCurrency(p.revenue)}</span>
              <span className={p.netIncome >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>
                {t.scenario.netShort}: {formatCurrency(p.netIncome)}
              </span>
            </div>
          </div>
          <div className="flex gap-1 h-4">
            <div
              className="bg-blue-400 dark:bg-blue-500 rounded-sm transition-all duration-300"
              style={{ width: `${(Math.abs(p.revenue) / maxVal) * 100}%` }}
            />
            <div
              className={`rounded-sm transition-all duration-300 ${p.netIncome >= 0 ? 'bg-emerald-400 dark:bg-emerald-500' : 'bg-red-400 dark:bg-red-500'}`}
              style={{ width: `${(Math.abs(p.netIncome) / maxVal) * 100}%` }}
            />
          </div>
        </div>
      ))}
      <div className="flex gap-4 pt-2 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-blue-400 dark:bg-blue-500" />
          {t.scenario.revenue}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-emerald-400 dark:bg-emerald-500" />
          {t.scenario.netIncome}
        </div>
      </div>
    </div>
  );
}

function ScenarioModelingPageInner() {
  const { t } = useLanguage();
  const {
    activeBusiness,
    loading,
    period,
    startDate,
    endDate,
    setPeriod,
    setStartDate,
    setEndDate,
    handlePeriodChange,
    baseline,
    optimistic,
    pessimistic,
    custom,
    optimisticAssumptions,
    pessimisticAssumptions,
    customAssumptions,
    setOptimisticAssumptions,
    setPessimisticAssumptions,
    setCustomAssumptions,
    projectionMonths,
    setProjectionMonths,
    projections,
  } = useScenarioModeling();

  const [activeTab, setActiveTab] = useState<'comparison' | 'custom'>('comparison');

  if (loading) {
    return <ReportSkeleton />;
  }

  if (!activeBusiness) {
    return (
      <div className="p-8">
        <EmptyState
          icon={Building2}
          title={t.common.noActiveBusiness}
          description={t.common.selectOrCreateBusiness}
          className="bg-gray-50 dark:bg-gray-800 rounded-xl"
        />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
          <FlaskConical className="w-7 h-7 text-indigo-500 dark:text-indigo-400" />
          {t.scenario.title}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t.scenario.subtitle.replace('{name}', activeBusiness.business_name)}
        </p>
      </div>

      {/* Period Filter */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
          <div className="flex-1">
            <label className="label">{t.scenario.baselinePeriod}</label>
            <div className="flex gap-2">
              {(['month', 'quarter', 'year', 'custom'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePeriodChange(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    period === p
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {p === 'month' ? t.scenario.periodMonth : p === 'quarter' ? t.scenario.periodQuarter : p === 'year' ? t.scenario.periodYear : t.scenario.periodCustom}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 items-end">
            <div>
              <label className="label flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {t.scenario.startDate}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPeriod('custom');
                }}
                className="input"
              />
            </div>
            <div>
              <label className="label">{t.scenario.endDate}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPeriod('custom');
                }}
                className="input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('comparison')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'comparison'
              ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          {t.scenario.comparisonTab}
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'custom'
              ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {t.scenario.customTab}
        </button>
      </div>

      {activeTab === 'comparison' && (
        <>
          {/* Scenario Comparison Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <ScenarioCard scenario={baseline} baseline={baseline} color="gray" icon={Minus} />
            <ScenarioCard scenario={optimistic} baseline={baseline} color="green" icon={TrendingUp} />
            <ScenarioCard scenario={pessimistic} baseline={baseline} color="red" icon={TrendingDown} />
          </div>

          {/* Assumption Editors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Optimistic Assumptions */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-gray-800 dark:text-gray-100">{t.scenario.assumptionsOptimistic}</h3>
              </div>
              <div className="space-y-4">
                <AssumptionSlider
                  label={t.scenario.revenueGrowth}
                  value={optimisticAssumptions.revenueGrowth}
                  onChange={(v) => setOptimisticAssumptions(prev => ({ ...prev, revenueGrowth: v }))}
                />
                <AssumptionSlider
                  label={t.scenario.cogsGrowth}
                  value={optimisticAssumptions.cogsGrowth}
                  onChange={(v) => setOptimisticAssumptions(prev => ({ ...prev, cogsGrowth: v }))}
                />
                <AssumptionSlider
                  label={t.scenario.opexGrowth}
                  value={optimisticAssumptions.opexGrowth}
                  onChange={(v) => setOptimisticAssumptions(prev => ({ ...prev, opexGrowth: v }))}
                />
                <AssumptionSlider
                  label={t.scenario.taxRate}
                  value={optimisticAssumptions.taxRate}
                  onChange={(v) => setOptimisticAssumptions(prev => ({ ...prev, taxRate: v }))}
                  min={0}
                  max={50}
                />
              </div>
            </div>

            {/* Pessimistic Assumptions */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-5 h-5 text-red-500" />
                <h3 className="font-bold text-gray-800 dark:text-gray-100">{t.scenario.assumptionsPessimistic}</h3>
              </div>
              <div className="space-y-4">
                <AssumptionSlider
                  label={t.scenario.revenueGrowth}
                  value={pessimisticAssumptions.revenueGrowth}
                  onChange={(v) => setPessimisticAssumptions(prev => ({ ...prev, revenueGrowth: v }))}
                />
                <AssumptionSlider
                  label={t.scenario.cogsGrowth}
                  value={pessimisticAssumptions.cogsGrowth}
                  onChange={(v) => setPessimisticAssumptions(prev => ({ ...prev, cogsGrowth: v }))}
                />
                <AssumptionSlider
                  label={t.scenario.opexGrowth}
                  value={pessimisticAssumptions.opexGrowth}
                  onChange={(v) => setPessimisticAssumptions(prev => ({ ...prev, opexGrowth: v }))}
                />
                <AssumptionSlider
                  label={t.scenario.taxRate}
                  value={pessimisticAssumptions.taxRate}
                  onChange={(v) => setPessimisticAssumptions(prev => ({ ...prev, taxRate: v }))}
                  min={0}
                  max={50}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'custom' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Custom Assumptions */}
          <div className="space-y-6">
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <SlidersHorizontal className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-gray-800 dark:text-gray-100">{t.scenario.customAssumptions}</h3>
              </div>
              <div className="space-y-4">
                <AssumptionSlider
                  label={t.scenario.revenueGrowth}
                  value={customAssumptions.revenueGrowth}
                  onChange={(v) => setCustomAssumptions(prev => ({ ...prev, revenueGrowth: v }))}
                />
                <AssumptionSlider
                  label={t.scenario.cogsGrowth}
                  value={customAssumptions.cogsGrowth}
                  onChange={(v) => setCustomAssumptions(prev => ({ ...prev, cogsGrowth: v }))}
                />
                <AssumptionSlider
                  label={t.scenario.opexGrowth}
                  value={customAssumptions.opexGrowth}
                  onChange={(v) => setCustomAssumptions(prev => ({ ...prev, opexGrowth: v }))}
                />
                <AssumptionSlider
                  label={t.scenario.interestGrowth}
                  value={customAssumptions.interestGrowth}
                  onChange={(v) => setCustomAssumptions(prev => ({ ...prev, interestGrowth: v }))}
                />
                <AssumptionSlider
                  label={t.scenario.taxRate}
                  value={customAssumptions.taxRate}
                  onChange={(v) => setCustomAssumptions(prev => ({ ...prev, taxRate: v }))}
                  min={0}
                  max={50}
                />
              </div>
            </div>

            {/* Scenario Result */}
            <ScenarioCard scenario={custom} baseline={baseline} color="blue" icon={FlaskConical} />
          </div>

          {/* Projection */}
          <div className="space-y-6">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <LineChart className="w-5 h-5 text-purple-500" />
                  <h3 className="font-bold text-gray-800 dark:text-gray-100">{t.scenario.financialProjection}</h3>
                </div>
                <select
                  value={projectionMonths}
                  onChange={(e) => setProjectionMonths(Number(e.target.value))}
                  className="input !w-auto text-sm"
                >
                  <option value={3}>3 Bulan</option>
                  <option value={6}>6 Bulan</option>
                  <option value={12}>12 Bulan</option>
                </select>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Proyeksi berdasarkan rata-rata performa bulanan dengan growth rate {customAssumptions.revenueGrowth > 0 ? '+' : ''}{customAssumptions.revenueGrowth}%
              </p>

              <ProjectionBar projections={projections} />
            </div>

            {/* Projection Summary */}
            {projections.length > 0 && (
              <div className="card">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">{t.scenario.projectionSummary}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                    <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">{t.scenario.totalRevenueProjection}</p>
                    <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                      {formatCurrency(projections.reduce((s, p) => s + p.revenue, 0))}
                    </p>
                  </div>
                  <div className={`rounded-xl p-4 ${
                    projections[projections.length - 1]?.cumulativeNetIncome >= 0
                      ? 'bg-emerald-50 dark:bg-emerald-900/20'
                      : 'bg-red-50 dark:bg-red-900/20'
                  }`}>
                    <p className={`text-xs mb-1 ${
                      projections[projections.length - 1]?.cumulativeNetIncome >= 0
                        ? 'text-emerald-500 dark:text-emerald-400'
                        : 'text-red-500 dark:text-red-400'
                    }`}>{t.scenario.cumulativeNetIncome}</p>
                    <p className={`text-lg font-bold ${
                      projections[projections.length - 1]?.cumulativeNetIncome >= 0
                        ? 'text-emerald-500 dark:text-emerald-300'
                        : 'text-red-500 dark:text-red-300'
                    }`}>
                      {formatCurrency(projections[projections.length - 1]?.cumulativeNetIncome ?? 0)}
                    </p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
                    <p className="text-xs text-purple-500 dark:text-purple-400 mb-1">{t.scenario.avgMonthlyRevenue}</p>
                    <p className="text-lg font-bold text-purple-500 dark:text-purple-300">
                      {formatCurrency(projections.reduce((s, p) => s + p.revenue, 0) / projections.length)}
                    </p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
                    <p className="text-xs text-amber-500 dark:text-amber-400 mb-1">{t.scenario.avgMonthlyNetIncome}</p>
                    <p className="text-lg font-bold text-amber-500 dark:text-amber-300">
                      {formatCurrency(projections.reduce((s, p) => s + p.netIncome, 0) / projections.length)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comparison Table */}
      <div className="card mt-6">
        <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">{t.scenario.comparisonTable}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-semibold">{t.scenario.metric}</th>
                <th className="text-right py-3 px-3 text-gray-500 dark:text-gray-400 font-semibold">{t.scenario.baseline}</th>
                <th className="text-right py-3 px-3 text-emerald-500 dark:text-emerald-400 font-semibold">{t.scenario.optimistic}</th>
                <th className="text-right py-3 px-3 text-red-500 dark:text-red-400 font-semibold">{t.scenario.pessimistic}</th>
                <th className="text-right py-3 px-3 text-blue-600 dark:text-blue-400 font-semibold">{t.scenario.customScenario}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {[
                { label: t.scenario.revenue, key: 'revenue' as const },
                { label: t.scenario.cogs, key: 'cogs' as const },
                { label: t.scenario.grossProfit, key: 'grossProfit' as const, bold: true },
                { label: t.scenario.opexLabel, key: 'opex' as const },
                { label: t.scenario.depreciation, key: 'depreciation' as const },
                { label: t.scenario.operatingIncome, key: 'operatingIncome' as const, bold: true },
                { label: t.scenario.interest, key: 'interest' as const },
                { label: t.scenario.tax, key: 'tax' as const },
                { label: t.scenario.netIncome, key: 'netIncome' as const, bold: true, highlight: true },
              ].map(({ label, key, bold, highlight }) => (
                <tr key={key} className={highlight ? 'bg-gray-50 dark:bg-gray-800/50' : ''}>
                  <td className={`py-2.5 px-3 ${bold ? 'font-semibold text-gray-800 dark:text-gray-200' : 'text-gray-600 dark:text-gray-400'}`}>
                    {label}
                  </td>
                  {[baseline, optimistic, pessimistic, custom].map((s, i) => (
                    <td key={i} className={`py-2.5 px-3 text-right tabular-nums ${bold ? 'font-semibold text-gray-800 dark:text-gray-200' : 'text-gray-700 dark:text-gray-300'}`}>
                      {formatCurrency(s[key])}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">{t.scenario.grossMargin}</td>
                {[baseline, optimistic, pessimistic, custom].map((s, i) => (
                  <td key={i} className="py-2.5 px-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{s.grossMargin.toFixed(1)}%</td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">{t.scenario.operatingMargin}</td>
                {[baseline, optimistic, pessimistic, custom].map((s, i) => (
                  <td key={i} className="py-2.5 px-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{s.operatingMargin.toFixed(1)}%</td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">{t.scenario.netMargin}</td>
                {[baseline, optimistic, pessimistic, custom].map((s, i) => (
                  <td key={i} className={`py-2.5 px-3 text-right tabular-nums font-semibold ${s.netMargin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                    {s.netMargin.toFixed(1)}%
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function ScenarioModelingPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <ScenarioModelingPageInner />
    </Suspense>
  );
}
