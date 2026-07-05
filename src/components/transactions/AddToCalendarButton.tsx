'use client';

import { useState, useEffect, useCallback } from 'react';
import { CalendarPlus, Loader2, CheckCircle2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import type { Transaction, BusinessUnit } from '@/types';
import { useBusinessContext } from '@/context/BusinessContext';
import { isManagerRole } from '@/lib/roles';
import { isAccommodationSector } from '@/lib/businessSectors';
import { getUnits } from '@/lib/api/units';
import { createBookingFromTransaction } from '@/lib/api/bookings';

/**
 * Tombol "Masukkan ke kalender" untuk transaksi EARN di bisnis akomodasi.
 * Ini SATU-SATUNYA cara data booking masuk dari transaksi: revenue yang sudah
 * tercatat di-flag → booking LUNAS di penampungan kalender (tanpa tanggal dulu),
 * owner melengkapi check-in/out di halaman kalender. Nama, harga, channel
 * di-agregat dari transaksi. Idempoten.
 */
export function AddToCalendarButton({ transaction }: { transaction: Transaction }) {
  const { activeBusiness, activeBusinessId, user, userRole } = useBusinessContext();
  const canManage = isManagerRole(userRole);
  const isAccommodation = isAccommodationSector(activeBusiness?.business_sector);
  const eligible =
    canManage &&
    isAccommodation &&
    transaction.category === 'EARN' &&
    transaction.status === 'posted';

  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  // Sudah tertaut sebelumnya?
  const alreadyLinked = !!(transaction.meta as { booking_id?: string } | null)?.booking_id;

  useEffect(() => {
    if (!eligible || !activeBusinessId) return;
    getUnits(activeBusinessId, { activeOnly: true })
      .then((u) => {
        setUnits(u);
        setSelectedUnitId((prev) => prev || u[0]?.id || '');
      })
      .catch(() => {});
  }, [eligible, activeBusinessId]);

  const handleAdd = useCallback(async () => {
    if (!activeBusinessId || !user) return;
    if (!selectedUnitId) return toast.error('Tambahkan unit di menu Kalender dulu.');
    setBusy(true);
    try {
      const booking = await createBookingFromTransaction(
        {
          id: transaction.id,
          business_id: activeBusinessId,
          name: transaction.name,
          amount: transaction.amount,
          sales_channel: transaction.sales_channel,
          meta: transaction.meta as Record<string, unknown> | null,
        },
        selectedUnitId,
        user.id
      );
      setDone(true);
      toast.success(
        booking.check_in
          ? 'Booking dibuat di kalender'
          : 'Masuk penampungan kalender — lengkapi tanggal check-in/out di menu Kalender'
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memasukkan ke kalender');
    } finally {
      setBusy(false);
    }
  }, [activeBusinessId, user, selectedUnitId, transaction]);

  if (!eligible) return null;

  if (alreadyLinked || done) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5" /> Sudah di kalender
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {units.length > 1 && (
        <div className="relative">
          <select
            value={selectedUnitId}
            onChange={(e) => setSelectedUnitId(e.target.value)}
            className="appearance-none pl-2.5 pr-7 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            aria-label="Unit"
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>
      )}
      <button
        type="button"
        onClick={handleAdd}
        disabled={busy}
        className="btn-ghost inline-flex items-center gap-1.5 text-xs disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarPlus className="w-3.5 h-3.5" />}
        Masukkan ke kalender
      </button>
    </div>
  );
}
