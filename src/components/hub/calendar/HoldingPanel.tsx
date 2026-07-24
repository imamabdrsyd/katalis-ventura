'use client';

import { useState, useMemo } from 'react';
import { differenceInCalendarDays, parseISO, format, addDays } from 'date-fns';
import { Loader2, CheckCircle2, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { Booking, BookingUpdate } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/utils';
import { BOOKING_CHANNEL_LABELS } from '@/lib/bookingStatus';
import { useLanguage } from '@/context/LanguageContext';

interface HoldingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  bookings: Booking[]; // booking tanpa tanggal (penampungan) untuk unit terpilih
  onUpdate: (id: string, updates: BookingUpdate) => Promise<Booking>;
  onReloaded: () => void;
}

/**
 * Modal "Perlu tindak lanjut" — booking di penampungan (hasil flag transaksi
 * EARN yang belum punya tanggal menginap). Owner mengisi check-in/out di sini;
 * setelah lengkap, booking pindah ke grid kalender. Harga tidak diubah (sudah
 * terkunci ke transaksi EARN); total_amount asli transaksi DIPERTAHANKAN
 * (revenue tak berubah), price_per_night di-recompute dari total/nights.
 */
export function HoldingPanel({ isOpen, onClose, bookings, onUpdate, onReloaded }: HoldingPanelProps) {
  const { t } = useLanguage();
  const c = t.calendar;
  const [drafts, setDrafts] = useState<Record<string, { checkIn: string; checkOut: string }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter((b) =>
      (b.guest_name || b.contact?.name || '').toLowerCase().includes(q)
    );
  }, [bookings, query]);

  const setDraft = (id: string, patch: Partial<{ checkIn: string; checkOut: string }>) =>
    setDrafts((p) => ({ ...p, [id]: { checkIn: p[id]?.checkIn ?? '', checkOut: p[id]?.checkOut ?? '', ...patch } }));

  const handleSave = async (b: Booking) => {
    const d = drafts[b.id];
    if (!d?.checkIn || !d?.checkOut) return toast.error(c.hpToastFillDates);
    if (d.checkOut <= d.checkIn) return toast.error(c.hpToastCheckoutAfter);
    const nights = Math.max(1, differenceInCalendarDays(parseISO(d.checkOut), parseISO(d.checkIn)));
    setBusyId(b.id);
    try {
      // Recompute harga/malam dari total asli (revenue tetap), tanggal diisi.
      await onUpdate(b.id, {
        check_in: d.checkIn,
        check_out: d.checkOut,
        price_per_night: Math.round(b.total_amount / nights),
      });
      toast.success(c.hpToastFilled);
      onReloaded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : c.hpToastSaveFailed);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      title={
        <span className="flex items-center gap-2">
          {c.hpTitle}
          <span className="font-normal text-gray-500 dark:text-gray-400">({bookings.length})</span>
        </span>
      }
    >
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{c.hpIntro}</p>

      {/* Search — panel bisa panjang, cari cepat by nama tamu */}
      {bookings.length > 5 && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={c.hpSearchGuest}
            className="input pl-9"
          />
        </div>
      )}

      {bookings.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">{c.hpEmpty}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
          {c.hpNoMatch.replace('{query}', query)}
        </p>
      ) : (
      <ul className="space-y-2">
        {filtered.map((b) => {
          const d = drafts[b.id] ?? { checkIn: '', checkOut: '' };
          return (
            <li
              key={b.id}
              className="flex flex-col lg:flex-row lg:items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-700 p-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {b.guest_name || b.contact?.name || c.hpGuest}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatCurrency(b.total_amount)} · {c.bmVia} {BOOKING_CHANNEL_LABELS[b.channel]}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  className="input py-1.5 text-sm"
                  value={d.checkIn}
                  onChange={(e) => setDraft(b.id, { checkIn: e.target.value })}
                  aria-label={c.bmCheckIn}
                />
                <span className="text-gray-400">→</span>
                <input
                  type="date"
                  className="input py-1.5 text-sm"
                  value={d.checkOut}
                  min={d.checkIn ? format(addDays(parseISO(d.checkIn), 1), 'yyyy-MM-dd') : undefined}
                  onChange={(e) => setDraft(b.id, { checkOut: e.target.value })}
                  aria-label={c.bmCheckOut}
                />
                <button
                  type="button"
                  onClick={() => handleSave(b)}
                  disabled={busyId === b.id}
                  className="btn-primary inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  {busyId === b.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {c.hpSave}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      )}
    </Modal>
  );
}
