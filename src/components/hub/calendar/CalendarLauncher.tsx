'use client';

/**
 * Isi tab "Kalender" di hub /calendar (bisnis jasa sektor akomodasi). Memuat
 * unit fisik (business_units) + Chart of Accounts. Setiap unit punya kalender,
 * occupancy, & kalender harga SENDIRI — kalau ada >1 unit, tampil pemilih unit
 * dan seluruh board/KPI/rate di-scope ke unit yang sedang dipilih.
 * Klik sel/booking membuka BookingModal (buat/edit/lunas).
 * Hanya manager/both/superadmin (kalender menulis transaksi EARN).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Lock, Loader2, Sparkles, ArrowRight, Tag, Settings2, Home, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { useBusinessContext } from '@/context/BusinessContext';
import { isManagerRole } from '@/lib/roles';
import { isAccommodationSector } from '@/lib/businessSectors';
import { getCatalogItems } from '@/lib/api/catalog';
import { getAccounts } from '@/lib/api/accounts';
import { getUnits } from '@/lib/api/units';
import { countUnlinkedStayTransactions, getPendingBookings } from '@/lib/api/bookings';
import { listDatesInRange } from '@/lib/rates';
import type { Account, Booking, BusinessUnit, CatalogItem } from '@/types';
import { useCalendar } from '@/hooks/useCalendar';
import { useDailyRates } from '@/hooks/useDailyRates';
import { Tabs } from '@/components/ui/Tabs';
import { CalendarBoard } from './CalendarBoard';
import { CalendarKpiStrip } from './CalendarKpiStrip';
import { BookingModal } from './BookingModal';
import { IcalSyncModal } from './IcalSyncModal';
import { RateEditorPanel } from './RateEditorPanel';
import { UnitManagerModal } from './UnitManagerModal';
import { HoldingPanel } from './HoldingPanel';

interface CalendarLauncherProps {
  /** Node header HubPage (di-passing dari atas) — pemilih unit + "Perlu tindak
   *  lanjut" di-portal ke sini agar sejajar dgn judul & tab, bukan baris terpisah. */
  headerSlot?: HTMLDivElement | null;
}

export function CalendarLauncher({ headerSlot }: CalendarLauncherProps) {
  const { activeBusinessId, activeBusiness, user, userRole } = useBusinessContext();
  const canManage = isManagerRole(userRole);
  const isAccommodation = isAccommodationSector(activeBusiness?.business_sector);

  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [rateItems, setRateItems] = useState<CatalogItem[]>([]); // catalog items yg bisa jadi sumber harga
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [unitManagerOpen, setUnitManagerOpen] = useState(false);
  const [holdingOpen, setHoldingOpen] = useState(false);

  const [unlinkedCount, setUnlinkedCount] = useState(0);
  const [reconciling, setReconciling] = useState(false);
  const [pending, setPending] = useState<Booking[]>([]); // booking penampungan (unit terpilih)

  // ── Set harga inline (tanpa mode terpisah) ────────────────────────────────
  // Seleksi rentang tanggal utk set harga (anchor → end, inklusif).
  const [selStart, setSelStart] = useState<string | null>(null);
  const [selEnd, setSelEnd] = useState<string | null>(null);

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
      const [unitList, catalog, accs] = await Promise.all([
        getUnits(activeBusinessId),
        getCatalogItems(activeBusinessId, { activeOnly: true }),
        getAccounts(activeBusinessId),
      ]);
      setUnits(unitList);
      setRateItems(catalog);
      setAccounts(accs);
      setSelectedUnitId((prev) => {
        if (prev && unitList.some((u) => u.id === prev)) return prev;
        return unitList.find((u) => u.is_active)?.id ?? unitList[0]?.id ?? null;
      });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, isAccommodation, activeBusinessId]);

  const activeUnits = useMemo(() => units.filter((u) => u.is_active), [units]);
  const selectedUnit = useMemo(
    () => units.find((u) => u.id === selectedUnitId) ?? activeUnits[0] ?? null,
    [units, selectedUnitId, activeUnits]
  );

  const calendar = useCalendar({
    businessId: activeBusinessId ?? '',
    unitId: selectedUnit?.id ?? '',
    userId: user?.id ?? '',
    accounts,
  });

  const rates = useDailyRates({
    businessId: activeBusinessId ?? '',
    userId: user?.id ?? '',
    unit: selectedUnit,
    gridStart: calendar.gridStart,
    gridEnd: calendar.gridEnd,
  });

  // Penampungan: booking tanpa tanggal untuk unit terpilih ("Perlu tindak lanjut").
  const refreshPending = useCallback(async () => {
    if (!activeBusinessId || !selectedUnit) {
      setPending([]);
      return;
    }
    try {
      setPending(await getPendingBookings(activeBusinessId, selectedUnit.id));
    } catch {
      setPending([]);
    }
  }, [activeBusinessId, selectedUnit]);

  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  const selectedDates = useMemo(() => {
    if (!selStart) return new Set<string>();
    return new Set(listDatesInRange(selStart, selEnd ?? selStart));
  }, [selStart, selEnd]);

  // Tanggal yang sudah dibooking (aktif) — dikecualikan dari set harga rentang.
  const bookedDates = useMemo(() => {
    const set = new Set<string>();
    for (const b of calendar.bookings) {
      if (!b.check_in || !b.check_out || b.status === 'cancelled') continue;
      const dates = listDatesInRange(b.check_in, b.check_out);
      // check_out eksklusif → buang malam terakhir (tanggal checkout)
      dates.slice(0, -1).forEach((d) => set.add(d));
    }
    return set;
  }, [calendar.bookings]);

  const clearSelection = useCallback(() => {
    setSelStart(null);
    setSelEnd(null);
  }, []);

  // Ganti unit → seleksi harga tak relevan lagi untuk unit baru.
  const handleUnitChange = useCallback(
    (unitId: string) => {
      setSelectedUnitId(unitId);
      clearSelection();
    },
    [clearSelection]
  );

  // Klik sel (hanya sel kosong & future — dijaga CalendarBoard) → pilih tanggal
  // utk set harga: klik pertama = anchor, kedua = ujung rentang, ketiga = mulai baru.
  const handleDayClick = useCallback(
    (dateISO: string) => {
      if (!selStart || selEnd) {
        setSelStart(dateISO);
        setSelEnd(null);
      } else {
        setSelEnd(dateISO);
      }
    },
    [selStart, selEnd]
  );

  const openEdit = useCallback((b: Booking) => {
    setEditing(b);
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
        `${data.linked} booking ditarik${data.pending > 0 ? ` (${data.pending} perlu diisi tanggalnya — cek "Perlu tindak lanjut")` : ''}`
      );
      await Promise.all([calendar.reload(), refreshUnlinked(), refreshPending()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menarik revenue');
    } finally {
      setReconciling(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  if (activeUnits.length === 0) {
    return (
      <>
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-5">
            <Home className="w-8 h-8 text-primary-500 dark:text-primary-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Belum ada unit</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-sm mx-auto mb-4">
            Tambahkan unit/kamar/villa yang bisa dibooking — tiap unit punya kalender & occupancy
            sendiri.
          </p>
          <button
            type="button"
            onClick={() => setUnitManagerOpen(true)}
            className="btn-primary-glow inline-flex items-center gap-2"
          >
            <Home className="w-4 h-4" /> Tambah unit pertama
          </button>
        </div>
        <UnitManagerModal
          isOpen={unitManagerOpen}
          onClose={() => setUnitManagerOpen(false)}
          businessId={activeBusinessId ?? ''}
          userId={user?.id ?? ''}
          units={units}
          rateItems={rateItems}
          onChanged={loadData}
        />
      </>
    );
  }

  if (!selectedUnit) return null; // tak akan terjadi — dijaga guard di atas

  // Pemilih unit + "Perlu tindak lanjut". Label nama unit = tombol Kelola unit
  // (ikon Settings2 + nama), 1 komponen — buka UnitManagerModal. Multi-unit
  // pakai Tabs selector + tombol Kelola unit terpisah. Tombol "Perlu tindak
  // lanjut" (penampungan) selalu bersebelahan.
  const unitToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {activeUnits.length > 1 ? (
        <Tabs
          value={selectedUnit.id}
          onChange={handleUnitChange}
          scrollable
          tabs={activeUnits.map((u) => ({ value: u.id, label: u.name }))}
        />
      ) : (
        <button
          type="button"
          onClick={() => setUnitManagerOpen(true)}
          className="btn-ghost inline-flex items-center gap-1.5"
          title="Kelola unit"
        >
          <Settings2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{selectedUnit.name}</span>
        </button>
      )}

      {pending.length > 0 && (
        <button
          type="button"
          onClick={() => setHoldingOpen(true)}
          className="btn-ghost inline-flex items-center gap-1.5"
          title="Booking dari transaksi yang belum ada tanggalnya"
        >
          <Inbox className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          Perlu tindak lanjut
          <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
            {pending.length}
          </span>
        </button>
      )}
      {activeUnits.length > 1 && (
        <button
          type="button"
          onClick={() => setUnitManagerOpen(true)}
          className="btn-ghost inline-flex items-center gap-1.5"
        >
          <Settings2 className="w-4 h-4" /> Kelola unit
        </button>
      )}
    </div>
  );

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

      {/* Pemilih unit (tiap unit = kalender terpisah) + "Perlu tindak lanjut" —
          di-portal ke header HubPage (sejajar judul & tab) bila slot tersedia,
          jatuh balik render inline di sini kalau belum (mis. sebelum mount). */}
      {headerSlot ? createPortal(unitToolbar, headerSlot) : unitToolbar}

      <CalendarKpiStrip bookings={calendar.bookings} monthCursor={calendar.monthCursor} unitsCount={1} />

      {/* Penampungan sebagai modal — dibuka dari tombol "Perlu tindak lanjut" */}
      <HoldingPanel
        isOpen={holdingOpen}
        onClose={() => setHoldingOpen(false)}
        bookings={pending}
        onUpdate={calendar.update}
        onReloaded={() => {
          refreshPending();
          calendar.reload();
        }}
      />

      {/* Unit belum punya sumber harga → set harga tak bisa; ajak ke Kelola Unit */}
      {!selectedUnit.rate_item && (
        <div className="card-static p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <Tag className="w-5 h-5 text-primary-500 dark:text-primary-400 shrink-0" />
          <p className="text-sm text-gray-700 dark:text-gray-200 flex-1">
            Unit <b>{selectedUnit.name}</b> belum punya item sumber harga. Pilih di <b>Kelola Unit</b>
            {' '}agar harga tampil di tiap tanggal & bisa di-set per tanggal.
          </p>
          <button
            type="button"
            onClick={() => setUnitManagerOpen(true)}
            className="btn-primary shrink-0"
          >
            Kelola unit
          </button>
        </div>
      )}

      {/* Panel set harga — muncul saat ada tanggal terpilih (klik sel kosong future) */}
      {selectedUnit.rate_item && selStart && (
        <RateEditorPanel
          rateItem={selectedUnit.rate_item}
          rangeStart={selStart <= (selEnd ?? selStart) ? selStart : (selEnd ?? selStart)}
          rangeEnd={selStart <= (selEnd ?? selStart) ? (selEnd ?? selStart) : selStart}
          excludeDates={bookedDates}
          onApply={rates.setPrices}
          onReset={rates.resetPrices}
          onClear={clearSelection}
        />
      )}

      {/* Hint set harga — saat ada sumber harga tapi belum memilih tanggal */}
      {selectedUnit.rate_item && !selStart && (
        <p className="text-xs text-gray-400 dark:text-gray-500 px-1">
          Klik tanggal kosong (hari ini ke depan) untuk set harga; klik tanggal lain untuk rentang.
          Sumber harga: <b>{selectedUnit.rate_item.name}</b> (default{' '}
          {Number(selectedUnit.rate_item.default_price).toLocaleString('id-ID')}).
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
        onJump={calendar.goToMonth}
        onOpenSync={() => setSyncOpen(true)}
        pricingEnabled={!!selectedUnit.rate_item}
        priceOf={selectedUnit.rate_item ? rates.priceOf : undefined}
        selectedDates={selectedDates}
      />

      <BookingModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        businessId={activeBusinessId ?? ''}
        unit={selectedUnit}
        booking={editing}
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
        units={activeUnits}
        onSynced={() => {
          loadData();
          calendar.reload();
        }}
      />

      <UnitManagerModal
        isOpen={unitManagerOpen}
        onClose={() => setUnitManagerOpen(false)}
        businessId={activeBusinessId ?? ''}
        userId={user?.id ?? ''}
        units={units}
        rateItems={rateItems}
        onChanged={loadData}
      />
    </div>
  );
}
