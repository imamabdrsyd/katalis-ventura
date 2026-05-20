'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Pause, Play, Square, Trash2, Calendar } from 'lucide-react';
import { formatFrequency } from '@/lib/api/recurring';
import type { RecurringTransaction } from '@/types';

const CATEGORY_LABELS: Record<string, string> = {
  EARN: 'Pendapatan',
  OPEX: 'Beban Operasional',
  VAR: 'Beban Variabel',
  CAPEX: 'Belanja Modal',
  TAX: 'Pajak',
  FIN: 'Financing',
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Aktif', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  paused: { label: 'Dijeda', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  stopped: { label: 'Dihentikan', color: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
};

interface RecurringListProps {
  items: RecurringTransaction[];
  loading: boolean;
  onPause: (id: string) => Promise<void>;
  onResume: (id: string) => Promise<void>;
  onStop: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function RecurringList({ items, loading, onPause, onResume, onStop, onDelete }: RecurringListProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAction = async (id: string, action: (id: string) => Promise<void>) => {
    setActionLoading(id);
    try {
      await action(id);
    } catch (err: any) {
      toast.error(err.message || 'Gagal melakukan aksi');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <RefreshCw className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Belum ada transaksi berulang.
        </p>
        <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
          Buat transaksi baru dan centang &quot;Jadikan Berulang&quot; untuk memulai.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {items.map((item) => {
        const status = STATUS_CONFIG[item.status];
        const isLoading = actionLoading === item.id;
        const isDue = new Date(item.next_due_date) <= new Date();

        return (
          <div
            key={item.id}
            className="flex items-center justify-between py-4 px-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            {/* Left: info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                <span className="font-medium text-gray-800 dark:text-gray-100 text-sm truncate">
                  {item.name}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                  {status.label}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span>{CATEGORY_LABELS[item.category] || item.category}</span>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>{formatFrequency(item.frequency, item.interval_value)}</span>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Berikutnya: {' '}
                  <span className={isDue && item.status === 'active' ? 'text-amber-500 font-medium' : ''}>
                    {new Date(item.next_due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </span>
                {item.total_generated > 0 && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span>{item.total_generated}x dibuat</span>
                  </>
                )}
              </div>
            </div>

            {/* Center: amount */}
            <div className="text-right mr-4">
              <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
                {Number(item.amount).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}
              </span>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-1">
              {item.status === 'active' && (
                <button
                  onClick={() => handleAction(item.id, onPause)}
                  disabled={isLoading}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50"
                  title="Jeda"
                >
                  <Pause className="w-4 h-4" />
                </button>
              )}
              {item.status === 'paused' && (
                <button
                  onClick={() => handleAction(item.id, onResume)}
                  disabled={isLoading}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50"
                  title="Lanjutkan"
                >
                  <Play className="w-4 h-4" />
                </button>
              )}
              {item.status !== 'stopped' && (
                <button
                  onClick={() => handleAction(item.id, onStop)}
                  disabled={isLoading}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  title="Hentikan"
                >
                  <Square className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => {
                  if (confirm('Hapus transaksi berulang ini? Transaksi yang sudah dibuat tidak akan terpengaruh.')) {
                    handleAction(item.id, onDelete);
                  }
                }}
                disabled={isLoading}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                title="Hapus"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
