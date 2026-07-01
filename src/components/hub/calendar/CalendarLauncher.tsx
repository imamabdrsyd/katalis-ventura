'use client';

/**
 * Isi tab "Kalender" di hub /calendar (bisnis jasa akomodasi). Memuat unit
 * (catalog_items) + Chart of Accounts, lalu menampilkan KPI hospitality +
 * month grid booking. Klik sel/booking membuka BookingModal (buat/edit/lunas).
 * Hanya manager/both/superadmin (kalender menulis transaksi EARN).
 */

import { useState, useEffect, useCallback } from 'react';
import { addDays, parseISO, format } from 'date-fns';
import { CalendarDays, Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useBusinessContext } from '@/context/BusinessContext';
import { isManagerRole } from '@/lib/roles';
import { getCatalogItems } from '@/lib/api/catalog';
import { getAccounts } from '@/lib/api/accounts';
import type { Account, Booking, CatalogItem } from '@/types';
import { useCalendar } from '@/hooks/useCalendar';
import { CalendarBoard } from './CalendarBoard';
import { CalendarKpiStrip } from './CalendarKpiStrip';
import { BookingModal, type BookingPrefill } from './BookingModal';
import { IcalSyncModal } from './IcalSyncModal';

export function CalendarLauncher() {
  const { activeBusinessId, user, userRole } = useBusinessContext();
  const canManage = isManagerRole(userRole);

  const [units, setUnits] = useState<CatalogItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [prefill, setPrefill] = useState<BookingPrefill | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!activeBusinessId) return;
    setLoadingData(true);
    try {
      const [catalog, accs] = await Promise.all([
        getCatalogItems(activeBusinessId, { activeOnly: true }),
        getAccounts(activeBusinessId),
      ]);
      setUnits(catalog);
      setAccounts(accs);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat data kalender');
    } finally {
      setLoadingData(false);
    }
  }, [activeBusinessId]);

  useEffect(() => {
    if (canManage) loadData();
  }, [canManage, loadData]);

  const calendar = useCalendar({
    businessId: activeBusinessId ?? '',
    userId: user?.id ?? '',
    accounts,
  });

  const openNew = useCallback(
    (dateISO?: string) => {
      const ci = dateISO ?? format(new Date(), 'yyyy-MM-dd');
      const co = format(addDays(parseISO(ci), 1), 'yyyy-MM-dd');
      setEditing(null);
      setPrefill({ check_in: ci, check_out: co, catalog_item_id: units[0]?.id });
      setModalOpen(true);
    },
    [units]
  );

  const openEdit = useCallback((b: Booking) => {
    setEditing(b);
    setPrefill(null);
    setModalOpen(true);
  }, []);

  if (!canManage) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-gray-400 dark:text-gray-500" />
        </div>
        <p className="font-semibold text-gray-700 dark:text-gray-200">Akses terbatas</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
          Hanya manager bisnis yang dapat mengelola kalender booking.
        </p>
      </div>
    );
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (units.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-5">
          <CalendarDays className="w-8 h-8 text-primary-500 dark:text-primary-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Belum ada unit</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-sm mx-auto">
          Tambahkan unit/kamar/villa (beserta harga per malam) di tab <b>Katalog</b> dulu, lalu
          kembali ke sini untuk mulai booking.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CalendarKpiStrip
        bookings={calendar.bookings}
        monthCursor={calendar.monthCursor}
        unitsCount={units.length}
      />

      <CalendarBoard
        monthCursor={calendar.monthCursor}
        gridStart={calendar.gridStart}
        gridEnd={calendar.gridEnd}
        bookings={calendar.bookings}
        loading={calendar.loading}
        onDayClick={openNew}
        onBookingClick={openEdit}
        onPrev={calendar.goPrevMonth}
        onNext={calendar.goNextMonth}
        onToday={calendar.goToday}
        onNew={() => openNew()}
        onOpenSync={() => setSyncOpen(true)}
      />

      <BookingModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        businessId={activeBusinessId ?? ''}
        units={units}
        accounts={accounts}
        booking={editing}
        prefill={prefill}
        onCreate={calendar.create}
        onUpdate={calendar.update}
        onMarkPaid={calendar.markPaid}
        onCancel={calendar.cancel}
        onDelete={calendar.remove}
        checkOverlap={calendar.checkOverlap}
      />

      <IcalSyncModal
        isOpen={syncOpen}
        onClose={() => setSyncOpen(false)}
        businessId={activeBusinessId ?? ''}
        units={units}
        onSynced={() => {
          loadData();
          calendar.reload();
        }}
      />
    </div>
  );
}
