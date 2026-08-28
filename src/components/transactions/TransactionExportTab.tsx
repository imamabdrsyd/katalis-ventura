'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';
import { runExportToast } from '@/lib/exportToast';
import { countTransactionsForExport, getTransactionsForExport } from '@/lib/api/transactions';
import {
  exportTransactionsToCsv,
  exportTransactionsToExcel,
} from '@/lib/transactionExport';
import type { Transaction, TransactionStatus } from '@/types';

type PeriodMode = 'all' | 'range';
type StatusFilter = 'all' | TransactionStatus;

/**
 * Tab "Export" di modal Import/Export transaksi.
 *
 * Mengambil datanya sendiri lewat `getTransactionsForExport()` (terpaginasi),
 * bukan memakai daftar yang sedang tampil di halaman: yang di layar sudah
 * terpotong paginasi dan filter tab, sehingga akan menghasilkan file yang
 * diam-diam tidak lengkap.
 */
export function TransactionExportTab({
  businessId,
  businessName,
}: {
  businessId: string;
  businessName: string;
}) {
  const { t } = useLanguage();
  const te = t.importModal;

  const [period, setPeriod] = useState<PeriodMode>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const [counting, setCounting] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [exporting, setExporting] = useState<'excel' | 'csv' | null>(null);

  const filters = useCallback(
    () => ({
      dateFrom: period === 'range' && dateFrom ? dateFrom : undefined,
      dateTo: period === 'range' && dateTo ? dateTo : undefined,
      status: status === 'all' ? undefined : status,
    }),
    [period, dateFrom, dateTo, status]
  );

  // Hitung ulang pratinjau tiap filter berubah, supaya user tahu berapa banyak
  // yang akan terunduh SEBELUM menekan tombol.
  useEffect(() => {
    let cancelled = false;
    setCounting(true);

    countTransactionsForExport(businessId, filters())
      .then((n) => {
        if (!cancelled) setCount(n);
      })
      .catch(() => {
        if (!cancelled) setCount(null);
      })
      .finally(() => {
        if (!cancelled) setCounting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [businessId, filters]);

  const rangeIncomplete = period === 'range' && (!dateFrom || !dateTo);
  const rangeInverted = period === 'range' && dateFrom && dateTo && dateFrom > dateTo;
  const disabled = exporting !== null || rangeIncomplete || Boolean(rangeInverted) || count === 0;

  const handleExport = async (format: 'excel' | 'csv') => {
    setExporting(format);
    try {
      await runExportToast(format === 'excel' ? 'excel' : 'backup', async () => {
        const rows: Transaction[] = await getTransactionsForExport(businessId, filters());

        if (rows.length === 0) {
          throw new Error(te.exportEmpty);
        }

        if (format === 'excel') {
          exportTransactionsToExcel(rows, businessName);
        } else {
          exportTransactionsToCsv(rows, businessName);
        }
      });
    } catch (e) {
      if (e instanceof Error && e.message === te.exportEmpty) toast.error(te.exportEmpty);
    } finally {
      setExporting(null);
    }
  };

  const inputCls =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">{te.exportTitle}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{te.exportHint}</p>
          </div>
        </div>
      </div>

      {/* Periode */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {te.exportPeriod}
        </label>
        <div className="flex flex-wrap gap-2">
          {(['all', 'range'] as PeriodMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setPeriod(mode)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === mode
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {mode === 'all' ? te.exportPeriodAll : te.exportPeriodRange}
            </button>
          ))}
        </div>

        {period === 'range' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                {te.exportDateFrom}
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                {te.exportDateTo}
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        )}

        {rangeInverted && (
          <p className="text-sm text-red-500 dark:text-red-400">{te.exportRangeInverted}</p>
        )}
      </div>

      {/* Status */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {te.exportStatus}
        </label>
        <div className="flex flex-wrap gap-2">
          {(['all', 'posted', 'draft'] as StatusFilter[]).map((value) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                status === value
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {value === 'all'
                ? te.exportStatusAll
                : value === 'posted'
                  ? te.exportStatusPosted
                  : te.exportStatusDraft}
            </button>
          ))}
        </div>
      </div>

      {/* Pratinjau jumlah */}
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        {counting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            {te.exportCounting}
          </>
        ) : count === null ? (
          <span className="text-gray-400 dark:text-gray-500">{te.exportCountUnknown}</span>
        ) : (
          <span>{te.exportCount.replace('{n}', count.toLocaleString('id-ID'))}</span>
        )}
      </div>

      {/* Tombol */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => handleExport('excel')}
          disabled={disabled}
          className="btn-primary-glow flex-1 justify-center inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting === 'excel' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4" />
          )}
          {te.exportExcel}
        </button>

        <button
          onClick={() => handleExport('csv')}
          disabled={disabled}
          className="btn-secondary flex-1 justify-center inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting === 'csv' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {te.exportCsv}
        </button>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">{te.exportCsvNote}</p>
    </div>
  );
}
