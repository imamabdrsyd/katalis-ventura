'use client';

import { useRef, useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Download, FileText, FileSpreadsheet } from 'lucide-react';
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
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportMenu]);

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

  // Detect kuartal mana yang sedang aktif (Q1-Q4)
  const selectedQuarterValue = (() => {
    if (!startDate || !endDate) return '';
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    if (!startYear || !startMonth || !startDay || !endYear || !endMonth || !endDay) return '';
    if (startYear !== endYear || startDay !== 1) return '';

    // Q1: Jan 1 - Mar 31, Q2: Apr 1 - Jun 30, Q3: Jul 1 - Sep 30, Q4: Oct 1 - Dec 31
    const quarterMap: Record<string, number> = {
      '1-3-31': 1,
      '4-6-30': 2,
      '7-9-30': 3,
      '10-12-31': 4,
    };
    const key = `${startMonth}-${endMonth}-${endDay}`;
    const q = quarterMap[key];
    return q ? `${startYear}-Q${q}` : '';
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

  // Tentukan bulan aktif (dari selectedMonthValue atau bulan sekarang sbg default)
  const activeMonth = (() => {
    if (selectedMonthValue) {
      const [y, m] = selectedMonthValue.split('-').map(Number);
      return { year: y, month: m };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  })();

  const activeMonthLabel = months[activeMonth.month - 1] ?? '';

  const handleMonthShift = (delta: number) => {
    let newMonth = activeMonth.month + delta;
    let newYear = activeMonth.year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    handleMonthDropdownChange(`${newYear}-${String(newMonth).padStart(2, '0')}`);
  };

  const handleQuarterDropdownChange = (value: string) => {
    if (!value) return;

    const [yearStr, qStr] = value.split('-Q');
    const year = Number(yearStr);
    const quarter = Number(qStr);
    if (!year || !quarter || quarter < 1 || quarter > 4) return;

    // Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = quarter * 3;
    const endDay = new Date(year, endMonth, 0).getDate();

    onStartDateChange(`${year}-${String(startMonth).padStart(2, '0')}-01`);
    onEndDateChange(`${year}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`);
    onPeriodChange('custom');
  };

  // Kuartal saat ini berdasarkan tanggal hari ini
  const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
  const currentYear = new Date().getFullYear();

  const hasMultipleExports = onExportPDF && onExportExcel;

  const handleSingleExport = () => {
    if (onExport) onExport();
    else if (onExportPDF) onExportPDF();
    else if (onExportExcel) onExportExcel();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <div className="space-y-4">
        {/* Period Label + Buttons + Month Dropdown — all in one row, wraps */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
            Periode
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {/* Month picker — prev | dropdown | next (chevron down dihilangkan, klik teks bulan untuk buka dropdown) */}
            <div
              className={`flex items-stretch rounded-lg ${
                selectedMonthValue && period === 'custom'
                  ? 'bg-indigo-100 dark:bg-indigo-900/40'
                  : 'bg-gray-100 dark:bg-gray-800'
              }`}
            >
              <button
                type="button"
                onClick={() => handleMonthShift(-1)}
                aria-label="Bulan sebelumnya"
                className={`pl-2 pr-1 flex items-center justify-center cursor-pointer transition-colors rounded-l-lg ${
                  selectedMonthValue && period === 'custom'
                    ? 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200/60 dark:hover:bg-indigo-800/40'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <select
                value={selectedMonthValue || `${activeMonth.year}-${String(activeMonth.month).padStart(2, '0')}`}
                onChange={(e) => handleMonthDropdownChange(e.target.value)}
                className={`appearance-none bg-transparent px-1 py-2 text-sm font-medium outline-none cursor-pointer text-center ${
                  selectedMonthValue && period === 'custom'
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
                aria-label="Pilih bulan laporan"
              >
                {months.map((monthName, index) => {
                  const month = String(index + 1).padStart(2, '0');
                  return (
                    <option key={month} value={`${monthDropdownYear}-${month}`}>
                      {monthName}
                    </option>
                  );
                })}
              </select>

              <button
                type="button"
                onClick={() => handleMonthShift(1)}
                aria-label="Bulan berikutnya"
                className={`pr-2 pl-1 flex items-center justify-center cursor-pointer transition-colors rounded-r-lg ${
                  selectedMonthValue && period === 'custom'
                    ? 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200/60 dark:hover:bg-indigo-800/40'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Kuartal dropdown — default ke kuartal saat ini (Q2, dll) */}
            <div className="relative">
              <select
                value={selectedQuarterValue || `${currentYear}-Q${currentQuarter}`}
                onChange={(e) => handleQuarterDropdownChange(e.target.value)}
                className={`appearance-none pl-4 pr-9 py-2 rounded-lg text-sm font-medium transition-all duration-200 outline-none cursor-pointer ${
                  selectedQuarterValue
                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
                aria-label="Pilih kuartal laporan"
              >
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={`${monthDropdownYear}-Q${q}`}>
                    Q{q}
                  </option>
                ))}
              </select>
              <svg
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Tahun Ini */}
            <button
              onClick={() => onPeriodChange('year')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                period === 'year'
                  ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              Tahun Ini
            </button>
          </div>
        </div>

        {/* Date Range Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              <Calendar className="w-3.5 h-3.5" />
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                onStartDateChange(e.target.value);
                onPeriodChange('custom');
              }}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                onEndDateChange(e.target.value);
                onPeriodChange('custom');
              }}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-colors"
            />
          </div>
        </div>

        {/* Export Button */}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => {
              if (hasMultipleExports) {
                setShowExportMenu(!showExportMenu);
              } else {
                handleSingleExport();
              }
            }}
            disabled={isExporting}
            className="w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100 font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
            {isExporting ? 'Mengunduh...' : 'Export'}
          </button>

          {showExportMenu && hasMultipleExports && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 py-2 z-20">
              <button
                onClick={() => {
                  onExportPDF?.();
                  setShowExportMenu(false);
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span>Export as PDF</span>
              </button>
              <button
                onClick={() => {
                  onExportExcel?.();
                  setShowExportMenu(false);
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Export as Excel</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
