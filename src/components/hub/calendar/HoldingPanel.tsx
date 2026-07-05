'use client';

import { useState } from 'react';
import { differenceInCalendarDays, parseISO, format, addDays } from 'date-fns';
import { Inbox, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Booking, BookingUpdate } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { BOOKING_CHANNEL_LABELS } from '@/lib/bookingStatus';

interface HoldingPanelProps {
  bookings: Booking[]; // booking tanpa tanggal (penampungan) untuk unit terpilih
  onUpdate: (id: string, updates: BookingUpdate) => Promise<Booking>;
  onReloaded: () => void;
}

/**
 * Panel "Perlu tindak lanjut" — booking di penampungan (hasil flag transaksi
 * EARN yang belum punya tanggal menginap). Owner mengisi check-in/out di sini;
 * setelah lengkap, booking pindah ke grid kalender. Harga tidak diubah (sudah
 * terkunci ke transaksi EARN); total di-recompute dari nights × harga bila mau,
 * tapi di sini kita PERTAHANKAN total_amount asli transaksi (revenue tak berubah).
 */
export function HoldingPanel({ bookings, onUpdate, onReloaded }: HoldingPanelProps) {
  const [drafts, setDrafts] = useState<Record<string, { checkIn: string; checkOut: string }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  if (bookings.length === 0) return null;

  const setDraft = (id: string, patch: Partial<{ checkIn: string; checkOut: string }>) =>
    setDrafts((p) => ({ ...p, [id]: { checkIn: p[id]?.checkIn ?? '', checkOut: p[id]?.checkOut ?? '', ...patch } }));

  const handleSave = async (b: Booking) => {
    const d = drafts[b.id];
    if (!d?.checkIn || !d?.checkOut) return toast.error('Isi check-in dan check-out.');
    if (d.checkOut <= d.checkIn) return toast.error('Check-out harus setelah check-in.');
    const nights = Math.max(1, differenceInCalendarDays(parseISO(d.checkOut), parseISO(d.checkIn)));
    setBusyId(b.id);
    try {
      // Recompute harga/malam dari total asli (revenue tetap), tanggal diisi.
      await onUpdate(b.id, {
        check_in: d.checkIn,
        check_out: d.checkOut,
        price_per_night: Math.round(b.total_amount / nights),
      });
      toast.success('Tanggal diisi — booking masuk kalender');
      onReloaded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card-static p-4">
      <div className="flex items-center gap-2 mb-3">
        <Inbox className="w-4 h-4 text-amber-500 dark:text-amber-400" />
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
          Perlu tindak lanjut
          <span className="ml-1.5 font-normal text-gray-500 dark:text-gray-400">
            ({bookings.length})
          </span>
        </h3>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Booking ini masuk dari transaksi (sudah lunas) tapi belum ada tanggal menginap. Lengkapi
        check-in/out agar tampil di kalender & terhitung di occupancy.
      </p>
      <ul className="space-y-2">
        {bookings.map((b) => {
          const d = drafts[b.id] ?? { checkIn: '', checkOut: '' };
          return (
            <li
              key={b.id}
              className="flex flex-col lg:flex-row lg:items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-700 p-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {b.guest_name || b.contact?.name || 'Tamu'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatCurrency(b.total_amount)} · via {BOOKING_CHANNEL_LABELS[b.channel]}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  className="input py-1.5 text-sm"
                  value={d.checkIn}
                  onChange={(e) => setDraft(b.id, { checkIn: e.target.value })}
                  aria-label="Check-in"
                />
                <span className="text-gray-400">→</span>
                <input
                  type="date"
                  className="input py-1.5 text-sm"
                  value={d.checkOut}
                  min={d.checkIn ? format(addDays(parseISO(d.checkIn), 1), 'yyyy-MM-dd') : undefined}
                  onChange={(e) => setDraft(b.id, { checkOut: e.target.value })}
                  aria-label="Check-out"
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
                  Simpan
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
