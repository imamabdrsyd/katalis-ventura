'use client';

import { useCallback, useEffect, useState } from 'react';
import { History, Loader2, ArrowDown, ArrowUp, RefreshCw } from 'lucide-react';
import { useBusinessContext } from '@/context/BusinessContext';
import { useLanguage } from '@/context/LanguageContext';
import { getStockLogs, type StockLogEntry } from '@/lib/api/catalog';

/**
 * Panel riwayat perubahan stok katalog (aside kanan hub POS, di bawah
 * Concierge Agent).
 *
 * Sumber data = audit_log lewat `getStockLogs()`, jadi mencakup semua jalur:
 * tambah stok manual, penjualan kasir, dan koreksi lewat form edit.
 *
 * Di-refresh oleh parent lewat prop `refreshKey` (naik tiap stok berubah)
 * supaya log langsung menyusul aksi tanpa reload halaman.
 */
export function StockLogPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const { activeBusiness } = useBusinessContext();
  const { t } = useLanguage();
  const tc = t.catalog;
  const businessId = activeBusiness?.id;

  const [logs, setLogs] = useState<StockLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      setLogs(await getStockLogs(businessId));
    } catch (err) {
      console.error('Gagal memuat riwayat stok:', err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <div className="card-static p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <History className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
          <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate">
            {tc.stockLogTitle}
          </h3>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          title={tc.stockLogRefresh}
          aria-label={tc.stockLogRefresh}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && logs.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-gray-400 dark:text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
          {tc.stockLogEmpty}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[26rem] overflow-y-auto -mx-1 px-1">
          {logs.map((log) => {
            const masuk = log.delta > 0;
            return (
              <li key={log.id} className="py-2.5 flex items-start gap-2.5">
                <span
                  className={`mt-0.5 shrink-0 w-6 h-6 rounded-lg flex items-center justify-center ${
                    masuk
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                  }`}
                >
                  {masuk ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="min-w-0 flex items-baseline gap-1.5">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {log.itemName}
                      </span>
                      {log.source === 'pos_sale' && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                          {tc.stockLogSaleChip}
                        </span>
                      )}
                    </p>
                    <span
                      className={`text-sm font-semibold tabular-nums shrink-0 ${
                        masuk
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {masuk ? '+' : ''}
                      {log.delta.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                    {log.from.toLocaleString('id-ID')} → {log.to.toLocaleString('id-ID')}
                    {log.changedByName ? ` · ${log.changedByName}` : ''}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(log.changedAt).toLocaleString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
