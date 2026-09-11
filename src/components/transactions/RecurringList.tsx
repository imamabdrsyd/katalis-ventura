'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ListSkeleton } from '@/components/ui/PageSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useConfirm } from '@/context/ConfirmContext';
import { RefreshCw, Pause, Play, Square, Trash2, Calendar } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import type { RecurringTransaction } from '@/types';

/** Warna status — labelnya dari kamus, lihat statusLabel() di dalam komponen. */
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  paused: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  stopped: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
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
  const confirm = useConfirm();
  const { t, locale } = useLanguage();
  const tr = t.recurring;
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Label status tidak bisa ikut di konstanta modul-level (tak bisa baca hook),
  // jadi dipisah dari petanya seperti pola typeLabel() di ContactList.
  const statusLabel = (status: string) =>
    ({ active: tr.statusActive, paused: tr.statusPaused, stopped: tr.statusStopped }[status] ?? status);

  const handleAction = async (id: string, action: (id: string) => Promise<void>) => {
    setActionLoading(id);
    try {
      await action(id);
    } catch (err: any) {
      toast.error(err.message || tr.actionFailed);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <ListSkeleton rows={4} className="p-4" />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState icon={RefreshCw} title={tr.emptyTitle} description={tr.emptyDescription} />
    );
  }

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {items.map((item) => {
        const statusColor = STATUS_COLORS[item.status] ?? STATUS_COLORS.stopped;
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
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                  {statusLabel(item.status)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span>{t.categories[item.category as keyof typeof t.categories] ?? item.category}</span>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>{tr.frequency(item.interval_value, item.frequency)}</span>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {tr.nextDue} {' '}
                  <span className={isDue && item.status === 'active' ? 'text-amber-500 font-medium' : ''}>
                    {new Date(item.next_due_date).toLocaleDateString(locale === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </span>
                {item.total_generated > 0 && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span>{tr.generatedCount(item.total_generated)}</span>
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
                  title={tr.pause}
                >
                  <Pause className="w-4 h-4" />
                </button>
              )}
              {item.status === 'paused' && (
                <button
                  onClick={() => handleAction(item.id, onResume)}
                  disabled={isLoading}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50"
                  title={tr.resume}
                >
                  <Play className="w-4 h-4" />
                </button>
              )}
              {item.status !== 'stopped' && (
                <button
                  onClick={() => handleAction(item.id, onStop)}
                  disabled={isLoading}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  title={tr.stop}
                >
                  <Square className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={async () => {
                  const ok = await confirm({
                    title: tr.deleteTitle,
                    message: tr.deleteMessage,
                  });
                  if (ok) handleAction(item.id, onDelete);
                }}
                disabled={isLoading}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                title={t.common.delete}
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
