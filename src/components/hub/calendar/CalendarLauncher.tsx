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
import { Lock, Loader2, Sparkles, ArrowRight, Tag, Settings2, Home, Inbox, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { useBusinessContext } from '@/context/BusinessContext';
import { useLanguage } from '@/context/LanguageContext';
import { isManagerRole } from '@/lib/roles';
import { getCatalogItems } from '@/lib/api/catalog';
import { getAccounts } from '@/lib/api/accounts';
import { countUnlinkedStayTransactions, getPendingBookings } from '@/lib/api/bookings';
import { listDatesInRange, buildUnitBaseRates } from '@/lib/rates';
import type { Account, Booking, CatalogItem } from '@/types';
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
import { useCalendarUnit } from './CalendarUnitContext';

interface CalendarLauncherProps {
  /** Node header HubPage (di-passing dari atas) — pemilih unit + "Perlu tindak
   *  lanjut" di-portal ke sini agar sejajar dgn judul & tab, bukan baris terpisah. */
  headerSlot?: HTMLDivElement | null;
}

export function CalendarLauncher({ headerSlot }: CalendarLauncherProps) {
  const { activeBusinessId, user, userRole } = useBusinessContext();
  const { t } = useLanguage();
  const c = t.calendar;
  const canManage = isManagerRole(userRole);
  // Unit aktif dari context (dibagi dgn tab Services). enabled = manager + akomodasi.
  const {
    enabled: isAccommodation,
    activeUnits,
    selectedUnit,
    setSelectedUnitId,
    loading: unitsLoading,
    reloadUnits,
  } = useCalendarUnit();

  // Item layanan unit terpilih (untuk base rates weekday/weekend/monthly) + CoA.
  const [unitItems, setUnitItems] = useState<CatalogItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingData, setLoadingData] = useState(true);

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

  // Muat CoA + item layanan unit terpilih (base rates) tiap ganti unit.
  const loadData = useCallback(async () => {
    if (!activeBusinessId || !selectedUnit) {
      setUnitItems([]);
      setLoadingData(false);
      return;
    }
    setLoadingData(true);
    try {
      const [catalog, accs] = await Promise.all([
        getCatalogItems(activeBusinessId, { activeOnly: true, unitId: selectedUnit.id }),
        getAccounts(activeBusinessId),
      ]);
      setUnitItems(catalog);
      setAccounts(accs);
      refreshUnlinked();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : c.loadFailed);
    } finally {
      setLoadingData(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId, selectedUnit?.id, refreshUnlinked]);

  useEffect(() => {
    if (canManage && isAccommodation) loadData();
    else setLoadingData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, isAccommodation, selectedUnit?.id]);

  // Base rates weekday/weekend/monthly dari item main-service unit terpilih.
  const baseRates = useMemo(() => buildUnitBaseRates(unitItems), [unitItems]);
  const hasRateSource = baseRates.weekday != null || baseRates.weekend != null;

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
    baseRates,
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
    [setSelectedUnitId, clearSelection]
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
      if (!res.ok) throw new Error(data?.error ?? c.reconcileFailed);
      const linkedMsg = c.reconcileSuccess.replace('{n}', String(data.linked));
      const pendingMsg =
        data.pending > 0 ? ` (${c.reconcilePendingSuffix.replace('{n}', String(data.pending))})` : '';
      toast.success(`${linkedMsg}${pendingMsg}`);
      await Promise.all([calendar.reload(), refreshUnlinked(), refreshPending()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : c.reconcileFailed);
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
        <p className="font-semibold text-gray-700 dark:text-gray-200">{c.accessRestricted}</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
          {c.accessRestrictedDesc}
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
          {c.accommodationOnly}
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 max-w-sm mx-auto">
          {c.accommodationOnlyDesc}
        </p>
      </div>
    );
  }

  if (unitsLoading || loadingData) {
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
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{c.noUnits}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-sm mx-auto mb-4">
            {c.noUnitsDesc}
          </p>
          <button
            type="button"
            onClick={() => setUnitManagerOpen(true)}
            className="btn-primary-glow inline-flex items-center gap-2"
          >
            <Home className="w-4 h-4" /> {c.addFirstUnit}
          </button>
        </div>
        <UnitManagerModal
          isOpen={unitManagerOpen}
          onClose={() => setUnitManagerOpen(false)}
          businessId={activeBusinessId ?? ''}
          userId={user?.id ?? ''}
          onChanged={reloadUnits}
        />
      </>
    );
  }

  if (!selectedUnit) return null; // tak akan terjadi — dijaga guard di atas

  // Urutan (kiri→kanan): [pemilih unit multi / kosong] · "Perlu tindak lanjut" ·
  // tombol "Kelola unit" (paling kanan). Single-unit: nama unit tampil sbg bagian
  // dari tombol Kelola unit. Semua buka UnitManagerModal / HoldingPanel.
  const manageUnitBtn = (
    <button
      type="button"
      onClick={() => setUnitManagerOpen(true)}
      className="btn-ghost inline-flex items-center gap-1.5"
      title={c.manageUnit}
    >
      <Settings2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
      {activeUnits.length > 1 ? (
        <span>{c.manageUnit}</span>
      ) : (
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{selectedUnit.name}</span>
      )}
    </button>
  );

  const unitToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {activeUnits.length > 1 && (
        <Tabs
          value={selectedUnit.id}
          onChange={handleUnitChange}
          scrollable
          tabs={activeUnits.map((u) => ({ value: u.id, label: u.name }))}
        />
      )}

      {pending.length > 0 && (
        <button
          type="button"
          onClick={() => setHoldingOpen(true)}
          className="btn-ghost inline-flex items-center gap-1.5"
          title={c.needsFollowUpTitle}
        >
          <Inbox className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          {c.needsFollowUp}
          <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
            {pending.length}
          </span>
        </button>
      )}

      {manageUnitBtn}
    </div>
  );

  return (
    <div className="space-y-4">
      {unlinkedCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-primary-100 dark:border-primary-900/40 bg-primary-50 dark:bg-primary-900/20 px-4 py-3">
          <Sparkles className="w-5 h-5 text-primary-500 dark:text-primary-400 shrink-0" />
          <p className="text-sm text-gray-700 dark:text-gray-200 flex-1">
            {c.reconcileBanner.split('{n}').flatMap((seg, i) =>
              i === 0 ? [seg] : [<b key={i}>{unlinkedCount}</b>, seg]
            )}
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
            {c.pullToCalendar}
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

      {/* Unit belum punya item tarif (weekday/weekend) → harga tak bisa tampil;
          ajak buat item layanan tarif di tab Layanan. */}
      {!hasRateSource && (
        <div className="card-static p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <Tag className="w-5 h-5 text-primary-500 dark:text-primary-400 shrink-0" />
          <p className="text-sm text-gray-700 dark:text-gray-200 flex-1">
            {c.noRateSource.split('{unit}').flatMap((seg, i) =>
              i === 0 ? [seg] : [<b key={i}>{selectedUnit.name}</b>, seg]
            )}
          </p>
        </div>
      )}

      {/* Panel set harga — muncul saat ada tanggal terpilih (klik sel kosong future) */}
      {hasRateSource && selStart && (
        <RateEditorPanel
          defaultPrice={baseRates.weekday ?? baseRates.weekend ?? 0}
          rangeStart={selStart <= (selEnd ?? selStart) ? selStart : (selEnd ?? selStart)}
          rangeEnd={selStart <= (selEnd ?? selStart) ? (selEnd ?? selStart) : selStart}
          excludeDates={bookedDates}
          onApply={rates.setPrices}
          onReset={rates.resetPrices}
          onClear={clearSelection}
        />
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
        pricingEnabled={hasRateSource}
        priceOf={hasRateSource ? rates.priceOf : undefined}
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
          reloadUnits();
          calendar.reload();
        }}
      />

      <UnitManagerModal
        isOpen={unitManagerOpen}
        onClose={() => setUnitManagerOpen(false)}
        businessId={activeBusinessId ?? ''}
        userId={user?.id ?? ''}
        onChanged={reloadUnits}
      />
    </div>
  );
}
