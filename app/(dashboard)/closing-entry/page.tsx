'use client';

import React, { Suspense, useState, useCallback } from 'react';
import { BookCheck, Calendar, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBusinessContext } from '@/context/BusinessContext';
import { getAccounts } from '@/lib/api/accounts';
import * as transactionsApi from '@/lib/api/transactions';
import { previewClosingEntries, executeClosingEntries } from '@/lib/accounting/closingEntry';
import { formatCurrency } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import type { ClosingEntryPreview } from '@/lib/accounting/closingEntry';

function ClosingEntryPageInner() {
  const { activeBusiness, activeBusinessId: businessId, user } = useBusinessContext();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  // Period defaults to current fiscal year
  const currentYear = new Date().getFullYear();
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(`${currentYear}-12-31`);
  const [preview, setPreview] = useState<ClosingEntryPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; count: number } | null>(null);

  // Fetch data
  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts', businessId],
    queryFn: () => getAccounts(businessId!),
    enabled: !!businessId,
  });

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['transactions', businessId],
    queryFn: () => transactionsApi.getTransactions(businessId!),
    enabled: !!businessId,
  });

  const isLoading = accountsLoading || txLoading;

  // Generate preview
  const handlePreview = useCallback(() => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setResult(null);
    try {
      const p = previewClosingEntries(transactions, accounts, startDate, endDate);
      setPreview(p);
    } finally {
      setLoading(false);
    }
  }, [transactions, accounts, startDate, endDate]);

  // Execute closing entries
  const handleExecute = useCallback(async () => {
    if (!preview || !businessId || !user) return;
    if (!preview.retainedEarningsAccountId) {
      alert('Akun Laba Ditahan (kode 3200) tidak ditemukan. Silakan buat akun ekuitas "Laba Ditahan" terlebih dahulu.');
      return;
    }

    const confirmed = window.confirm(
      `Anda akan membuat ${preview.revenueLines.length + preview.expenseLines.length} jurnal penutup untuk periode ${startDate} s/d ${endDate}. Laba bersih ${formatCurrency(preview.netIncome)} akan ditransfer ke Laba Ditahan. Lanjutkan?`
    );
    if (!confirmed) return;

    setExecuting(true);
    try {
      const ids = await executeClosingEntries(businessId, user.id, preview);
      setResult({ success: true, count: ids.length });
      setPreview(null);
      queryClient.invalidateQueries({ queryKey: ['transactions', businessId] });
    } catch (err: any) {
      alert(err.message || 'Gagal membuat jurnal penutup');
      setResult({ success: false, count: 0 });
    } finally {
      setExecuting(false);
    }
  }, [preview, businessId, user, startDate, endDate, queryClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (!activeBusiness) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500 dark:text-gray-400">Pilih bisnis terlebih dahulu.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
          <BookCheck className="w-7 h-7 text-indigo-500 dark:text-indigo-400" />
          Tutup Buku
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Generate jurnal penutup otomatis — tutup akun Revenue & Expense ke Laba Ditahan
        </p>
      </div>

      {/* Period Selection */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Periode Tutup Buku
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tanggal Mulai</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPreview(null); setResult(null); }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tanggal Akhir</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPreview(null); setResult(null); }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
            />
          </div>
          <button
            onClick={handlePreview}
            disabled={loading || !startDate || !endDate}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {loading ? '{t.closingEntry.calculating}' : '{t.closingEntry.preview}'}
          </button>
        </div>
      </div>

      {/* Success Result */}
      {result?.success && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6 mb-6 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-emerald-700 dark:text-emerald-300">Buku berhasil ditutup!</p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              {result.count} jurnal penutup telah dibuat untuk periode {startDate} s/d {endDate}.
            </p>
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="space-y-6">
          {/* No retained earnings warning */}
          {!preview.retainedEarningsAccountId && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-300">Akun Laba Ditahan tidak ditemukan</p>
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Silakan buat akun Ekuitas dengan kode 3200 dan nama &quot;Laba Ditahan&quot; di Chart of Accounts terlebih dahulu.
                </p>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-xs text-gray-500 uppercase mb-1">{t.closingEntry.totalRevenue}</p>
              <p className={`text-xl font-bold ${preview.totalRevenue === 0 ? 'text-gray-500 dark:text-gray-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{formatCurrency(preview.totalRevenue)}</p>
              <p className="text-xs text-gray-500">{preview.revenueLines.length} akun</p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-xs text-gray-500 uppercase mb-1">{t.closingEntry.totalExpense}</p>
              <p className={`text-xl font-bold ${preview.totalExpense === 0 ? 'text-gray-500 dark:text-gray-400' : 'text-red-500 dark:text-red-400'}`}>{formatCurrency(preview.totalExpense)}</p>
              <p className="text-xs text-gray-500">{preview.expenseLines.length} akun</p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-xs text-gray-500 uppercase mb-1">Laba Bersih → Laba Ditahan</p>
              <p className={`text-xl font-bold ${preview.netIncome === 0 ? 'text-gray-500 dark:text-gray-400' : preview.netIncome > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                {formatCurrency(preview.netIncome)}
              </p>
              <p className="text-xs text-gray-500">{preview.netIncome >= 0 ? 'Laba' : 'Rugi'} periode ini</p>
            </div>
          </div>

          {/* Detail Tables */}
          {preview.revenueLines.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t.closingEntry.revenueClosing}</h3>
                <p className="text-xs text-gray-500">Dr Pendapatan / Cr Laba Ditahan</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
                    <th className="py-2 px-4 text-xs font-medium text-gray-500">Kode</th>
                    <th className="py-2 px-4 text-xs font-medium text-gray-500">{t.closingEntry.accountName}</th>
                    <th className="py-2 px-4 text-xs font-medium text-gray-500 text-right">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.revenueLines.map((l) => (
                    <tr key={l.accountId} className="border-b border-gray-50 dark:border-gray-800">
                      <td className="py-2 px-4 text-gray-600 dark:text-gray-400 font-mono">{l.accountCode}</td>
                      <td className="py-2 px-4 text-gray-900 dark:text-gray-100">{l.accountName}</td>
                      <td className="py-2 px-4 text-right text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(l.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.expenseLines.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t.closingEntry.expenseClosing}</h3>
                <p className="text-xs text-gray-500">Dr Laba Ditahan / Cr Beban</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
                    <th className="py-2 px-4 text-xs font-medium text-gray-500">Kode</th>
                    <th className="py-2 px-4 text-xs font-medium text-gray-500">{t.closingEntry.accountName}</th>
                    <th className="py-2 px-4 text-xs font-medium text-gray-500 text-right">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.expenseLines.map((l) => (
                    <tr key={l.accountId} className="border-b border-gray-50 dark:border-gray-800">
                      <td className="py-2 px-4 text-gray-600 dark:text-gray-400 font-mono">{l.accountCode}</td>
                      <td className="py-2 px-4 text-gray-900 dark:text-gray-100">{l.accountName}</td>
                      <td className="py-2 px-4 text-right text-red-500 dark:text-red-400 font-medium">{formatCurrency(l.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Execute Button */}
          {preview.retainedEarningsAccountId && (preview.revenueLines.length > 0 || preview.expenseLines.length > 0) && (
            <div className="flex justify-end">
              <button
                onClick={handleExecute}
                disabled={executing}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                {executing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    {t.closingEntry.processing}
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    Tutup Buku ({preview.revenueLines.length + preview.expenseLines.length} jurnal)
                  </>
                )}
              </button>
            </div>
          )}

          {/* Empty state */}
          {preview.revenueLines.length === 0 && preview.expenseLines.length === 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
              <BookCheck className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="font-medium text-gray-500 dark:text-gray-400">Tidak ada akun untuk ditutup</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Tidak ada transaksi Revenue atau Expense di periode ini, atau buku sudah ditutup.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Initial state */}
      {!preview && !result && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
          <BookCheck className="w-16 h-16 mx-auto mb-4 text-gray-200 dark:text-gray-700" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">Pilih periode dan klik &quot;Preview&quot;</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Sistem akan menghitung saldo Revenue & Expense yang perlu ditutup ke Laba Ditahan.
          </p>
        </div>
      )}
    </div>
  );
}

export default function ClosingEntryPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
      </div>
    }>
      <ClosingEntryPageInner />
    </Suspense>
  );
}
