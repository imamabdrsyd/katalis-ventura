'use client';

import { useState } from 'react';
import { Calendar, TrendingUp, TrendingDown, Minus, FlaskConical, BarChart3, SlidersHorizontal, LineChart } from 'lucide-react';
import { useScenarioModeling, type ScenarioResult } from '@/hooks/useScenarioModeling';
import { formatCurrency } from '@/lib/utils';
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
          value < 0 ? 'text-red-600 dark:text-red-400' :
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
  const colorMap = {
    green: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      border: 'border-emerald-200 dark:border-emerald-800',
      title: 'text-emerald-800 dark:text-emerald-300',
      accent: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    },
    red: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      title: 'text-red-800 dark:text-red-300',
      accent: 'text-red-600 dark:text-red-400',
      iconBg: 'bg-red-100 dark:bg-red-900/40',
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
            <span className={`text-xs font-medium ${netDiff >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {netDiff >= 0 ? '+' : ''}{formatCurrency(netDiff)} ({netDiffPct >= 0 ? '+' : ''}{netDiffPct.toFixed(1)}%)
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2.5">
        <Row label="Revenue" value={scenario.revenue} />
        <Row label="COGS" value={-scenario.cogs} negative />
        <Divider />
        <Row label="Gross Profit" value={scenario.grossProfit} bold />
        <Row label="OpEx" value={-scenario.opex} negative />
        <Divider />
        <Row label="Operating Income" value={scenario.operatingIncome} bold />
        <Row label="Interest" value={-scenario.interest} negative />
        <Row label="Tax" value={-scenario.tax} negative />
        <Divider />
        <div className={`flex justify-between items-center pt-1 ${
          scenario.netIncome >= 0
            ? 'text-green-700 dark:text-green-400'
            : 'text-red-700 dark:text-red-400'
        }`}>
          <span className="font-bold">Net Income</span>
          <span className="font-bold text-lg">{formatCurrency(scenario.netIncome)}</span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-2">
        <MarginBadge label="Gross" value={scenario.grossMargin} />
        <MarginBadge label="Operating" value={scenario.operatingMargin} />
        <MarginBadge label="Net" value={scenario.netMargin} />
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
        negative ? 'text-red-600 dark:text-red-400' :
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
        value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
      }`}>
        {value.toFixed(1)}%
      </p>
    </div>
  );
}

function ProjectionBar({ projections }: { projections: { month: string; revenue: number; netIncome: number; cumulativeNetIncome: number }[] }) {
  if (projections.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 dark:text-gray-500">
        <LineChart className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Belum ada data transaksi untuk proyeksi</p>
      </div>
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
              <span className="text-blue-600 dark:text-blue-400">Rev: {formatCurrency(p.revenue)}</span>
              <span className={p.netIncome >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                Net: {formatCurrency(p.netIncome)}
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
          Revenue
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-emerald-400 dark:bg-emerald-500" />
          Net Income
        </div>
      </div>
    </div>
  );
}

export default function ScenarioModelingPage() {
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
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!activeBusiness) {
    return (
      <div className="p-8">
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <div className="text-4xl mb-4">🏢</div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
            Tidak ada bisnis aktif
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Pilih atau buat bisnis terlebih dahulu
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Scenario Modeling</h1>
            <p className="text-gray-500 dark:text-gray-400">
              Simulasi skenario keuangan - {activeBusiness.business_name}
            </p>
          </div>
        </div>
      </div>

      {/* Period Filter */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
          <div className="flex-1">
            <label className="label">Periode Baseline</label>
            <div className="flex gap-2">
              {(['month', 'quarter', 'year', 'custom'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePeriodChange(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    period === p
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {p === 'month' ? 'Bulan Ini' : p === 'quarter' ? 'Kuartal' : p === 'year' ? 'Tahun Ini' : 'Custom'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 items-end">
            <div>
              <label className="label flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Start Date
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
              <label className="label">End Date</label>
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
              ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Perbandingan Skenario
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'custom'
              ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Custom Scenario & Proyeksi
        </button>
      </div>

      {activeTab === 'comparison' && (
        <>
          {/* Scenario Comparison Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <ScenarioCard scenario={baseline} baseline={baseline} color="gray" icon={Minus} />
            <ScenarioCard scenario={optimistic} baseline={baseline} color="green" icon={TrendingUp} />
            <ScenarioCard scenario={pessimistic} baseline={baseline} color="red" icon={TrendingDown} />
          </div>

          {/* Assumption Editors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Optimistic Assumptions */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-gray-800 dark:text-gray-100">Asumsi Optimistic</h3>
              </div>
              <div className="space-y-4">
                <AssumptionSlider
                  label="Revenue Growth"
                  value={optimisticAssumptions.revenueGrowth}
                  onChange={(v) => setOptimisticAssumptions(prev => ({ ...prev, revenueGrowth: v }))}
                />
                <AssumptionSlider
                  label="COGS Growth"
                  value={optimisticAssumptions.cogsGrowth}
                  onChange={(v) => setOptimisticAssumptions(prev => ({ ...prev, cogsGrowth: v }))}
                />
                <AssumptionSlider
                  label="OpEx Growth"
                  value={optimisticAssumptions.opexGrowth}
                  onChange={(v) => setOptimisticAssumptions(prev => ({ ...prev, opexGrowth: v }))}
                />
                <AssumptionSlider
                  label="Tax Rate (% of EBT)"
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
                <h3 className="font-bold text-gray-800 dark:text-gray-100">Asumsi Pessimistic</h3>
              </div>
              <div className="space-y-4">
                <AssumptionSlider
                  label="Revenue Growth"
                  value={pessimisticAssumptions.revenueGrowth}
                  onChange={(v) => setPessimisticAssumptions(prev => ({ ...prev, revenueGrowth: v }))}
                />
                <AssumptionSlider
                  label="COGS Growth"
                  value={pessimisticAssumptions.cogsGrowth}
                  onChange={(v) => setPessimisticAssumptions(prev => ({ ...prev, cogsGrowth: v }))}
                />
                <AssumptionSlider
                  label="OpEx Growth"
                  value={pessimisticAssumptions.opexGrowth}
                  onChange={(v) => setPessimisticAssumptions(prev => ({ ...prev, opexGrowth: v }))}
                />
                <AssumptionSlider
                  label="Tax Rate (% of EBT)"
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Custom Assumptions */}
          <div className="space-y-6">
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <SlidersHorizontal className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-gray-800 dark:text-gray-100">Custom Assumptions</h3>
              </div>
              <div className="space-y-4">
                <AssumptionSlider
                  label="Revenue Growth"
                  value={customAssumptions.revenueGrowth}
                  onChange={(v) => setCustomAssumptions(prev => ({ ...prev, revenueGrowth: v }))}
                />
                <AssumptionSlider
                  label="COGS Growth"
                  value={customAssumptions.cogsGrowth}
                  onChange={(v) => setCustomAssumptions(prev => ({ ...prev, cogsGrowth: v }))}
                />
                <AssumptionSlider
                  label="OpEx Growth"
                  value={customAssumptions.opexGrowth}
                  onChange={(v) => setCustomAssumptions(prev => ({ ...prev, opexGrowth: v }))}
                />
                <AssumptionSlider
                  label="Interest Growth"
                  value={customAssumptions.interestGrowth}
                  onChange={(v) => setCustomAssumptions(prev => ({ ...prev, interestGrowth: v }))}
                />
                <AssumptionSlider
                  label="Tax Rate (% of EBT)"
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
                  <h3 className="font-bold text-gray-800 dark:text-gray-100">Proyeksi Keuangan</h3>
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
                <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">Ringkasan Proyeksi</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                    <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Total Revenue Proyeksi</p>
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
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>Kumulatif Net Income</p>
                    <p className={`text-lg font-bold ${
                      projections[projections.length - 1]?.cumulativeNetIncome >= 0
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-red-700 dark:text-red-300'
                    }`}>
                      {formatCurrency(projections[projections.length - 1]?.cumulativeNetIncome ?? 0)}
                    </p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
                    <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Avg Monthly Revenue</p>
                    <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
                      {formatCurrency(projections.reduce((s, p) => s + p.revenue, 0) / projections.length)}
                    </p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
                    <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Avg Monthly Net Income</p>
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
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
        <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">Perbandingan Detail Semua Skenario</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-semibold">Metrik</th>
                <th className="text-right py-3 px-3 text-gray-500 dark:text-gray-400 font-semibold">Baseline</th>
                <th className="text-right py-3 px-3 text-emerald-600 dark:text-emerald-400 font-semibold">Optimistic</th>
                <th className="text-right py-3 px-3 text-red-600 dark:text-red-400 font-semibold">Pessimistic</th>
                <th className="text-right py-3 px-3 text-blue-600 dark:text-blue-400 font-semibold">Custom</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {[
                { label: 'Revenue', key: 'revenue' as const },
                { label: 'COGS', key: 'cogs' as const },
                { label: 'Gross Profit', key: 'grossProfit' as const, bold: true },
                { label: 'OpEx', key: 'opex' as const },
                { label: 'Operating Income', key: 'operatingIncome' as const, bold: true },
                { label: 'Interest', key: 'interest' as const },
                { label: 'Tax', key: 'tax' as const },
                { label: 'Net Income', key: 'netIncome' as const, bold: true, highlight: true },
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
                <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">Gross Margin</td>
                {[baseline, optimistic, pessimistic, custom].map((s, i) => (
                  <td key={i} className="py-2.5 px-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{s.grossMargin.toFixed(1)}%</td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">Operating Margin</td>
                {[baseline, optimistic, pessimistic, custom].map((s, i) => (
                  <td key={i} className="py-2.5 px-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{s.operatingMargin.toFixed(1)}%</td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">Net Margin</td>
                {[baseline, optimistic, pessimistic, custom].map((s, i) => (
                  <td key={i} className={`py-2.5 px-3 text-right tabular-nums font-semibold ${s.netMargin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
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
