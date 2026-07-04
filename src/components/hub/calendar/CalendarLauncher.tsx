'use client';

/**
 * Isi tab "Kalender" di hub /calendar (bisnis jasa akomodasi). Memuat unit
 * (catalog_items) + Chart of Accounts, lalu menampilkan KPI hospitality +
 * month grid booking. Klik sel/booking membuka BookingModal (buat/edit/lunas).
 * Hanya manager/both/superadmin (kalender menulis transaksi EARN).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { addDays, parseISO, format } from 'date-fns';
import { CalendarDays, Lock, Loader2, Sparkles, ArrowRight, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { useBusinessContext } from '@/context/BusinessContext';
import { isManagerRole } from '@/lib/roles';
import { isAccommodationSector } from '@/lib/businessSectors';
import { getCatalogItems } from '@/lib/api/catalog';
import { getAccounts } from '@/lib/api/accounts';
import { countUnlinkedStayTransactions } from '@/lib/api/bookings';
import { setCalendarRateItem } from '@/lib/api/dailyRates';
import { listDatesInRange } from '@/lib/rates';
import type { Account, Booking, CatalogItem } from '@/types';
import { useCalendar } from '@/hooks/useCalendar';
import { useDailyRates } from '@/hooks/useDailyRates';
import { CalendarBoard, type CalendarMode } from './CalendarBoard';
import { CalendarKpiStrip } from './CalendarKpiStrip';
import { BookingModal, type BookingPrefill } from './BookingModal';
import { IcalSyncModal } from './IcalSyncModal';
import { RateEditorPanel } from './RateEditorPanel';

export function CalendarLauncher() {
  const { activeBusinessId, activeBusiness, user, userRole } = useBusinessContext();
  const canManage = isManagerRole(userRole);
  const isAccommodation = isAccommodationSector(activeBusiness?.business_sector);

  const [units, setUnits] = useState<CatalogItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [prefill, setPrefill] = useState<BookingPrefill | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);

  const [unlinkedCount, setUnlinkedCount] = useState(0);
  const [reconciling, setReconciling] = useState(false);

  // ── Kalender harga (mode Harga) ──────────────────────────────────────────
  const [mode, setMode] = useState<CalendarMode>('booking');
  // Item sumber harga; init dari businesses.calendar_rate_item_id, bisa diganti.
  const [rateItemId, setRateItemId] = useState<string | null>(
    activeBusiness?.calendar_rate_item_id ?? null
  );
  // Seleksi rentang tanggal di mode Harga (anchor → end, inklusif).
  const [selStart, setSelStart] = useState<string | null>(null);
  const [selEnd, setSelEnd] = useState<string | null>(null);

  useEffect(() => {
    setRateItemId(activeBusiness?.calendar_rate_item_id ?? null);
  }, [activeBusiness?.calendar_rate_item_id]);

  const refreshUnlinked = useCallback(async () => {
    if (!activeBusinessId || !isAccommodation) return;
    try {
      setUnlinkedCount(await countUnlinkedStayTransactions(activeBusinessId));
    } catch {
      /* non-kritis */
    }
  }, [activeBusinessId, isAccommodation]);

  const loadData = useCallback(async () => {
    if (!activeBusinessId) return;
    setLoadingData(true);
    try {
      const [catalog, accs] = await Promise.all([
        getCatalogItems(activeBusinessId, { activeOnly: true }),
        getAccounts(activeBusinessId),
      ]);
      // Hanya unit kamar (flag migr 115) — rate plan/add-on (cleaning fee, sewa
      // bulanan) tidak masuk dropdown unit & denominator occupancy/RevPAR.
      setUnits(catalog.filter((c) => c.is_bookable_unit !== false));
      setAccounts(accs);
      refreshUnlinked();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat data kalender');
    } finally {
      setLoadingData(false);
    }
  }, [activeBusinessId, refreshUnlinked]);

  useEffect(() => {
    if (canManage && isAccommodation) loadData();
    else setLoadingData(false);
  }, [canManage, isAccommodation, loadData]);

  const calendar = useCalendar({
    businessId: activeBusinessId ?? '',
    userId: user?.id ?? '',
    accounts,
  });

  const rateItem = useMemo(
    () => units.find((u) => u.id === rateItemId) ?? null,
    [units, rateItemId]
  );

  const rates = useDailyRates({
    businessId: activeBusinessId ?? '',
    userId: user?.id ?? '',
    rateItem,
    gridStart: calendar.gridStart,
    gridEnd: calendar.gridEnd,
  });

  const selectedDates = useMemo(() => {
    if (!selStart) return new Set<string>();
    return new Set(listDatesInRange(selStart, selEnd ?? selStart));
  }, [selStart, selEnd]);

  const clearSelection = useCallback(() => {
    setSelStart(null);
    setSelEnd(null);
  }, []);

  // Ganti mode → bersihkan seleksi supaya tak ada highlight nyangkut.
  const handleModeChange = useCallback(
    (m: CalendarMode) => {
      setMode(m);
      clearSelection();
    },
    [clearSelection]
  );

  const handleChangeRateItem = useCallback(
    async (itemId: string) => {
      if (!activeBusinessId) return;
      setRateItemId(itemId); // optimistic — kalender langsung pakai harga item baru
      try {
        await setCalendarRateItem(activeBusinessId, itemId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal menyimpan item sumber harga');
      }
    },
    [activeBusinessId]
  );

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

  // Klik sel: mode booking → buka form; mode harga → seleksi rentang
  // (klik pertama = anchor, klik kedua = ujung rentang, klik ketiga = mulai baru).
  const handleDayClick = useCallback(
    (dateISO: string) => {
      if (mode === 'booking') {
        openNew(dateISO);
        return;
      }
      if (!selStart || selEnd) {
        setSelStart(dateISO);
        setSelEnd(null);
      } else {
        setSelEnd(dateISO);
      }
    },
    [mode, selStart, selEnd, openNew]
  );

  const openEdit = useCallback((b: Booking) => {
    setEditing(b);
    setPrefill(null);
    setModalOpen(true);
  }, []);

  const handleReconcile = useCallback(async () => {
    if (!activeBusinessId) return;
    setReconciling(true);
    try {
      const res = await fetch('/api/calendar/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ businessId: activeBusinessId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Gagal menarik revenue');
      toast.success(
        `${data.linked} booking dibuat dari revenue${data.estimated > 0 ? ` (${data.estimated} tanggal perkiraan — cek di kalender)` : ''}`
      );
      await Promise.all([calendar.reload(), refreshUnlinked()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menarik revenue');
    } finally {
      setReconciling(false);
    }
  }, [activeBusinessId, calendar, refreshUnlinked]);

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

  if (!isAccommodation) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
          <CalendarDays className="w-6 h-6 text-gray-400 dark:text-gray-500" />
        </div>
        <p className="font-semibold text-gray-700 dark:text-gray-200">
          Kalender booking khusus sektor akomodasi
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 max-w-sm mx-auto">
          Kalender booking kamar (per malam) tersedia untuk bisnis akomodasi &amp; sewa jangka
          pendek. Penjadwalan berbasis janji temu untuk jasa lain menyusul.
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
      {unlinkedCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-primary-100 dark:border-primary-900/40 bg-primary-50 dark:bg-primary-900/20 px-4 py-3">
          <Sparkles className="w-5 h-5 text-primary-500 dark:text-primary-400 shrink-0" />
          <p className="text-sm text-gray-700 dark:text-gray-200 flex-1">
            <b>{unlinkedCount}</b> transaksi revenue menginap belum ada di kalender. Tarik supaya
            ADR/occupancy terhitung — yang tanpa tanggal pasti ditaruh di tanggal transaksi
            (bisa dikoreksi).
          </p>
          <button
            type="button"
            onClick={handleReconcile}
            disabled={reconciling}
            className="btn-primary inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50"
          >
            {reconciling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            Tarik ke kalender
          </button>
        </div>
      )}

      <CalendarKpiStrip
        bookings={calendar.bookings}
        monthCursor={calendar.monthCursor}
        unitsCount={units.length}
      />

      {/* Mode Harga: pilih item sumber dulu bila belum ditunjuk */}
      {mode === 'rates' && !rateItem && (
        <div className="card-static p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <Tag className="w-5 h-5 text-primary-500 dark:text-primary-400 shrink-0" />
          <p className="text-sm text-gray-700 dark:text-gray-200 flex-1">
            Pilih item katalog yang jadi <b>harga dasar kalender</b> (mis. tarif harian). Harga
            default item ini tampil di tiap tanggal, lalu bisa di-override per tanggal/rentang.
          </p>
          <select
            className="input w-auto"
            value=""
            onChange={(e) => e.target.value && handleChangeRateItem(e.target.value)}
          >
            <option value="">— pilih item —</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Mode Harga: panel set harga saat ada tanggal terpilih */}
      {mode === 'rates' && rateItem && selStart && (
        <RateEditorPanel
          rateItem={rateItem}
          rateItems={units}
          onChangeRateItem={handleChangeRateItem}
          rangeStart={selStart <= (selEnd ?? selStart) ? selStart : (selEnd ?? selStart)}
          rangeEnd={selStart <= (selEnd ?? selStart) ? (selEnd ?? selStart) : selStart}
          onApply={rates.setPrices}
          onReset={rates.resetPrices}
          onClear={clearSelection}
        />
      )}

      {/* Mode Harga: hint saat belum ada seleksi */}
      {mode === 'rates' && rateItem && !selStart && (
        <p className="text-xs text-gray-400 dark:text-gray-500 px-1">
          Klik satu tanggal lalu klik tanggal lain untuk memilih rentang — panel harga akan muncul.
          Sumber harga: <b>{rateItem.name}</b> (default{' '}
          {Number(rateItem.default_price).toLocaleString('id-ID')}).
        </p>
      )}

      <CalendarBoard
        monthCursor={calendar.monthCursor}
        gridStart={calendar.gridStart}
        gridEnd={calendar.gridEnd}
        bookings={calendar.bookings}
        loading={calendar.loading || rates.loading}
        onDayClick={handleDayClick}
        onBookingClick={openEdit}
        onPrev={calendar.goPrevMonth}
        onNext={calendar.goNextMonth}
        onToday={calendar.goToday}
        onNew={() => openNew()}
        onOpenSync={() => setSyncOpen(true)}
        mode={mode}
        onModeChange={handleModeChange}
        priceOf={rateItem ? rates.priceOf : undefined}
        selectedDates={selectedDates}
      />

      <BookingModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        businessId={activeBusinessId ?? ''}
        units={units}
        accounts={accounts}
        booking={editing}
        prefill={prefill}
        rateItemId={rateItemId}
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
