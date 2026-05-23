'use client';

import { useState } from 'react';
import { Calendar, Download, ChevronDown } from 'lucide-react';
import type { Period } from '@/hooks/useReportData';

interface PeriodFilterCardProps {
  period: Period;
  startDate: string;
  endDate: string;
  onPeriodChange: (period: Period) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  onExport?: () => void;
  isExporting?: boolean;
  months: string[];
}

export function PeriodFilterCard({
  period,
  startDate,
  endDate,
  onPeriodChange,
  onStartDateChange,
  onEndDateChange,
  onExportPDF,
  onExportExcel,
  onExport,
  isExporting = false,
  months,
}: PeriodFilterCardProps) {
  const [isDateInputsExpanded, setIsDateInputsExpanded] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const monthDropdownYear = (() => {
    const year = Number(startDate.slice(0, 4));
    return Number.isFinite(year) && year > 0 ? year : new Date().getFullYear();
  })();

  const selectedMonthValue = (() => {
    if (!startDate || !endDate) return '';
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    if (!startYear || !startMonth || !startDay || !endYear || !endMonth || !endDay) return '';
    if (startYear !== endYear || startMonth !== endMonth || startDay !== 1) return '';

    const lastDay = new Date(startYear, startMonth, 0).getDate();
    return endDay === lastDay ? `${startYear}-${String(startMonth).padStart(2, '0')}` : '';
  })();

  const handleMonthDropdownChange = (value: string) => {
    if (!value) return;

    const [year, month] = value.split('-').map(Number);
    if (!year || !month) return;

    const lastDay = new Date(year, month, 0).getDate();
    onStartDateChange(`${year}-${String(month).padStart(2, '0')}-01`);
    onEndDateChange(`${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
    onPeriodChange('custom');
  };

  const periodOptions: { value: Period; label: string; description: string }[] = [
    { value: 'month', label: 'Bulan Ini', description: 'Current month' },
    { value: 'quarter', label: 'Kuartal', description: 'Current quarter' },
    { value: 'year', label: 'Tahun Ini', description: 'Current year' },
  ];

  const formattedStartDate = startDate ? new Date(startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const formattedEndDate = endDate ? new Date(endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Periode Laporan
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Pilih rentang tanggal untuk laporan keuangan
        </p>
      </div>

      {/* Content */}
      <div className="px-6 py-6 space-y-6">
        {/* Period Buttons */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Periode Cepat
          </label>
          <div className="grid grid-cols-3 gap-2">
            {periodOptions.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onPeriodChange(value)}
                className={`relative px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 overflow-hidden group ${
                  period === value
                    ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <span className="relative z-10">{label}</span>
                {period === value && (
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Month Dropdown */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Pilih Bulan
          </label>
          <div className="relative">
            <select
              value={selectedMonthValue}
              onChange={(e) => handleMonthDropdownChange(e.target.value)}
              className={`w-full appearance-none px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 outline-none cursor-pointer ${
                selectedMonthValue && period === 'custom'
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-100'
                  : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
              aria-label="Pilih bulan laporan"
            >
              <option value="">Pilih Bulan...</option>
              {months.map((monthName, index) => {
                const month = String(index + 1).padStart(2, '0');
                return (
                  <option key={month} value={`${monthDropdownYear}-${month}`}>
                    {monthName} {monthDropdownYear}
                  </option>
                );
              })}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Custom Date Range */}
        <div>
          <button
            onClick={() => setIsDateInputsExpanded(!isDateInputsExpanded)}
            className="w-full px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between group"
          >
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              Tanggal Kustom
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${isDateInputsExpanded ? 'rotate-180' : ''}`} />
          </button>

          {isDateInputsExpanded && (
            <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-3 border border-gray-200 dark:border-gray-700 animate-in fade-in slide-in-from-top-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      onStartDateChange(e.target.value);
                      onPeriodChange('custom');
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                    Tanggal Akhir
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      onEndDateChange(e.target.value);
                      onPeriodChange('custom');
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-colors"
                  />
                </div>
              </div>
              {formattedStartDate && formattedEndDate && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{formattedStartDate}</span>
                    {' '} hingga {' '}
                    <span className="font-medium text-gray-900 dark:text-gray-100">{formattedEndDate}</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Export Button */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={isExporting}
            className="w-full px-4 py-3 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-400 text-white font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-95 disabled:cursor-not-allowed"
          >
            <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
            {isExporting ? 'Mengunduh...' : 'Unduh Laporan'}
          </button>

          {showExportMenu && (onExportPDF || onExportExcel) && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 py-2 z-10">
              {onExportPDF && (
                <button
                  onClick={() => {
                    onExportPDF();
                    setShowExportMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 transition-colors"
                >
                  <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span>Unduh sebagai PDF</span>
                </button>
              )}
              {onExportExcel && (
                <button
                  onClick={() => {
                    onExportExcel();
                    setShowExportMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Unduh sebagai Excel</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Summary */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>Periode Aktif</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {formattedStartDate && formattedEndDate ? `${formattedStartDate} – ${formattedEndDate}` : 'Belum dipilih'}
          </span>
        </div>
      </div>
    </div>
  );
}
