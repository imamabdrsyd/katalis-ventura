'use client';

import { useState, useEffect, useMemo } from 'react';
import { differenceInCalendarDays, parseISO, format, addDays } from 'date-fns';
import { AlertTriangle, Loader2, Trash2, Ban, CheckCircle2, ExternalLink, Home, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import type {
  BusinessUnit,
  Booking,
  BookingChannel,
  BookingStatus,
  BookingUpdate,
  Contact,
} from '@/types';
import type { PaymentMethod } from '@/lib/accounting/salesCheckout';
import { Modal } from '@/components/ui/Modal';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import FloatingField, { FloatingSelect } from '@/components/ui/FloatingField';
import { ContactAutocomplete } from '@/components/transactions/ContactAutocomplete';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { getDailyRates } from '@/lib/api/dailyRates';
import { quoteStayV2, groupIntoRanges, type StayQuote, type UnitBaseRates } from '@/lib/rates';
import { getBookingDisplayState, BOOKING_DOT_CLASSES, type BookingDisplayState } from '@/lib/bookingStatus';
import { useLanguage } from '@/context/LanguageContext';
import type { Translations } from '@/lib/i18n/types';

// Label state/status/channel dwibahasa (menggantikan konstanta ID di bookingStatus).
function stateLabel(s: BookingDisplayState, c: Translations['calendar']): string {
  const m: Record<BookingDisplayState, string> = {
    paid: c.statePaid, confirmed: c.stateConfirmed, checked_in: c.statusCheckedIn,
    tentative: c.stateInquiry, cancelled: c.statusCancelled, external: c.stateExternal,
  };
  return m[s];
}
function statusLabel(s: BookingStatus, c: Translations['calendar']): string {
  const m: Record<BookingStatus, string> = {
    tentative: c.statusTentative, confirmed: c.statusConfirmed, checked_in: c.statusCheckedIn,
    completed: c.statusCompleted, cancelled: c.statusCancelled,
  };
  return m[s];
}
function channelLabel(ch: BookingChannel, c: Translations['calendar']): string {
  const m: Record<BookingChannel, string> = {
    manual: c.channelManual, airbnb: 'Airbnb', booking_com: 'Booking.com',
    website: c.channelWebsite, other: c.channelOther,
  };
  return m[ch];
}

/** Prefill saat membuat booking baru (dari klik sel tanggal atau konversi lead). */
export interface BookingPrefill {
  check_in: string;
  check_out: string;
  guest_name?: string;
  channel?: BookingChannel;
}

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  /** Unit fisik yang sedang dilihat kalendernya — booking selalu milik unit ini. */
  unit: BusinessUnit;
  /** Base rates unit (weekday/weekend/monthly, migr 124) — untuk auto-quote booking
   *  belum lunas. Menggantikan `unit.rate_item` yang deprecated. */
  baseRates: UnitBaseRates;
  /** Booking yang dilihat/diedit. Modal ini EDIT-ONLY (booking mengalir dari
   *  transaksi/omnichannel — tak ada create di kalender). */
  booking: Booking | null;
  /** Harus mengembalikan booking hasil update — dipakai handleMarkPaid agar ledger mencatat nilai form terbaru. */
  onUpdate: (id: string, updates: BookingUpdate) => Promise<Booking>;
  onMarkPaid: (booking: Booking, method: PaymentMethod) => Promise<unknown>;
  onCancel: (id: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  checkOverlap: (
    unitId: string,
    checkIn: string,
    checkOut: string,
    excludeId?: string
  ) => Promise<Booking[]>;
}

const EDITABLE_STATUSES: BookingStatus[] = ['tentative', 'confirmed', 'checked_in'];

export function BookingModal({
  isOpen,
  onClose,
  businessId,
  unit,
  baseRates,
  booking,
  onUpdate,
  onMarkPaid,
  onCancel,
  onDelete,
  checkOverlap,
}: BookingModalProps) {
  const { t } = useLanguage();
  const c = t.calendar;
  const isExternal = !!booking?.is_external;
  const isPaid = booking?.payment_status === 'paid';
  // Booking LUNAS = revenue sudah terkunci di ledger → harga/total tak boleh
  // diubah. Tapi TANGGAL tetap boleh diedit (koreksi) selama non-eksternal.
  const priceLocked = isExternal || isPaid;
  const datesLocked = isExternal;

  // ── Form state ────────────────────────────────────────────────────────────
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guestName, setGuestName] = useState('');
  const [contactId, setContactId] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState('');
  const [pricePerNight, setPricePerNight] = useState('');
  const [channel, setChannel] = useState<BookingChannel>('manual');
  const [status, setStatus] = useState<BookingStatus>('confirmed');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  const [conflicts, setConflicts] = useState<Booking[]>([]);
  const [busy, setBusy] = useState(false);
  // Modal buka dalam mode VIEW dulu (read-only); klik "Edit" untuk mengubah.
  // Blok OTA eksternal tak bisa diedit → paksa tetap view.
  const [isEditing, setIsEditing] = useState(false);
  // Quote otomatis dari kalender harga (Σ harga per malam) — hanya saat unit
  // ini punya rate_item terpasang. Null = mode manual (harga flat × malam).
  const [autoQuote, setAutoQuote] = useState<StayQuote | null>(null);

  // Reset form saat modal dibuka / target berubah. Modal ini EDIT-ONLY —
  // booking selalu ada (dari transaksi/omnichannel).
  useEffect(() => {
    if (!isOpen || !booking) return;
    setCheckIn(booking.check_in ?? '');
    setCheckOut(booking.check_out ?? '');
    setGuestName(booking.guest_name ?? booking.contact?.name ?? '');
    setContactId(booking.contact_id ?? null);
    setGuestCount(booking.guest_count != null ? String(booking.guest_count) : '');
    setPricePerNight(String(booking.price_per_night));
    setChannel(booking.channel);
    setStatus(booking.status);
    setNotes(booking.notes ?? '');
    setPaymentMethod('cash');
    setConflicts([]);
    setIsEditing(false); // selalu buka di mode view
  }, [isOpen, booking]);

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    try {
      return Math.max(0, differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn)));
    } catch {
      return 0;
    }
  }, [checkIn, checkOut]);

  const price = Number(pricePerNight) || 0;
  const datesValid = nights > 0;
  // Total: quote kalender harga bila aktif; selain itu flat harga × malam.
  const total = autoQuote ? autoQuote.total : nights * price;

  // ── Auto-quote kalender harga (migr 124) — hanya untuk booking BELUM lunas (mis.
  // tentatif dari website) yang harganya masih boleh dihitung ulang. Base rates
  // weekday/weekend/monthly unit + override per tanggal → quoteStayV2.
  const hasBaseRate = baseRates.weekday != null || baseRates.weekend != null;
  const rateQuoteActive = !priceLocked && hasBaseRate;
  useEffect(() => {
    if (!rateQuoteActive || !datesValid) {
      setAutoQuote(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const lastNight = format(addDays(parseISO(checkOut), -1), 'yyyy-MM-dd');
        const overrides = await getDailyRates(unit.id, checkIn, lastNight);
        if (cancelled) return;
        const q = quoteStayV2(
          checkIn,
          checkOut,
          baseRates,
          overrides.map((o) => ({ date: o.date, price: Number(o.price) }))
        );
        setAutoQuote(q);
        // Sinkronkan field harga/malam sebagai rata-rata (informatif; total tetap Σ).
        if (q.nights > 0) setPricePerNight(String(Math.round(q.total / q.nights)));
      } catch {
        if (!cancelled) setAutoQuote(null);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [rateQuoteActive, datesValid, unit.id, baseRates, checkIn, checkOut]);

  // Ringkasan breakdown per rentang harga ("2 mlm × 350rb + 1 mlm × 750rb").
  const quoteBreakdownLabel = useMemo(() => {
    if (!autoQuote) return null;
    return groupIntoRanges(autoQuote.breakdown)
      .map((r) => c.bmNightsTimes.replace('{nights}', String(r.nights)).replace('{price}', formatCurrency(r.price)))
      .join(' + ');
  }, [autoQuote, c]);

  // ── Overlap guard (debounced) ──────────────────────────────────────────────
  useEffect(() => {
    if (datesLocked || !datesValid) {
      setConflicts([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await checkOverlap(unit.id, checkIn, checkOut, booking?.id);
        if (!cancelled) setConflicts(res);
      } catch {
        if (!cancelled) setConflicts([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [datesLocked, unit.id, checkIn, checkOut, datesValid, checkOverlap, booking?.id]);

  const hasConflict = conflicts.length > 0;

  // ── Actions ─────────────────────────────────────────────────────────────────
  const buildBase = (): BookingUpdate => {
    const base: BookingUpdate = {
      unit_id: unit.id,
      contact_id: contactId,
      check_in: checkIn,
      check_out: checkOut,
      guest_name: guestName.trim() || null,
      guest_count: guestCount ? Number(guestCount) : null,
      status,
      notes: notes.trim() || null,
    };
    // Harga/total & channel hanya boleh diubah bila belum lunas (revenue terkunci
    // ke transaksi EARN untuk booking lunas).
    if (!priceLocked) {
      base.price_per_night = price;
      base.total_amount = total;
      base.channel = channel;
    }
    return base;
  };

  const handleSubmit = async () => {
    if (!booking) return;
    if (!datesValid) return toast.error(c.bmToastDatesInvalid);
    if (hasConflict) return toast.error(c.bmToastConflict);
    setBusy(true);
    try {
      await onUpdate(booking.id, buildBase());
      toast.success(c.bmToastUpdated);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : c.bmToastSaveFailed);
    } finally {
      setBusy(false);
    }
  };

  // Update status saja untuk booking yang sudah lunas (tanpa ubah ledger).
  const handleStatusUpdate = async (newStatus: BookingStatus) => {
    if (!booking) return;
    setStatus(newStatus);
    setBusy(true);
    try {
      await onUpdate(booking.id, { status: newStatus });
      toast.success(c.bmToastStatusUpdated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : c.bmToastStatusFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!booking) return;
    if (!datesValid) return toast.error(c.bmToastDatesInvalid);
    if (hasConflict) return toast.error(c.bmToastConflict);
    if (total <= 0) return toast.error(c.bmToastTotalPositive);
    setBusy(true);
    try {
      // Simpan nilai form dulu (harga/tanggal/status) supaya ledger mencatat
      // angka yang tampil di tombol — bukan snapshot booking sebelum diedit.
      const saved = await onUpdate(booking.id, buildBase());
      await onMarkPaid(saved, paymentMethod);
      toast.success(c.bmToastMarkedPaid);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : c.bmToastMarkPaidFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!booking) return;
    setBusy(true);
    try {
      await onCancel(booking.id);
      toast.success(c.bmToastCancelled);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : c.bmToastCancelFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!booking) return;
    setBusy(true);
    try {
      await onDelete(booking.id);
      toast.success(c.bmToastDeleted);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : c.bmToastDeleteFailed);
    } finally {
      setBusy(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const displayState = booking ? getBookingDisplayState(booking) : null;

  const title = isExternal ? c.bmTitleExternal : c.bmTitleDetail;

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <button type="button" onClick={onClose} className="btn-ghost">
        {c.bmClose}
      </button>
      {!isExternal &&
        (isEditing ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy || hasConflict || !datesValid}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {c.bmSaveChanges}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Pencil className="w-4 h-4" /> {c.bmEdit}
          </button>
        ))}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg" footer={footer}>
      <div className="space-y-5">
        {/* Unit (fixed — kalender ini scoped ke satu unit) */}
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <Home className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          {c.bmForUnit} <span className="font-semibold text-gray-900 dark:text-gray-100">{unit.name}</span>
        </div>

        {/* Status + channel badge (edit) */}
        {booking && displayState && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
              <span className={`w-2 h-2 rounded-full ${BOOKING_DOT_CLASSES[displayState]}`} />
              {stateLabel(displayState, c)}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {c.bmVia} {channelLabel(booking.channel, c)}
            </span>
            {isPaid && booking.transaction_id && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> {c.bmRecordedInBooks}
              </span>
            )}
          </div>
        )}

        {/* External read-only note */}
        {isExternal && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 flex items-start gap-3">
            <ExternalLink className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {c.bmExternalNote.replace('{channel}', channelLabel(channel, c))}
            </p>
          </div>
        )}

        {/* Booking lunas dari transaksi (revenue terkunci) */}
        {isPaid && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-3 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-sm text-emerald-800 dark:text-emerald-300">{c.bmPaidNote}</p>
          </div>
        )}

        {/* ── MODE VIEW (read-only) ─────────────────────────────────────────── */}
        {!isEditing && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <ViewRow label={c.bmCheckIn} value={checkIn ? format(parseISO(checkIn), 'dd MMM yyyy') : '—'} />
              <ViewRow label={c.bmCheckOut} value={checkOut ? format(parseISO(checkOut), 'dd MMM yyyy') : '—'} />
              <ViewRow label={c.bmGuest} value={guestName || '—'} />
              <ViewRow label={c.bmGuestCount} value={guestCount || '—'} />
              <ViewRow label={c.bmPricePerNight} value={formatCurrency(price)} />
              <ViewRow label={c.bmChannel} value={channelLabel(channel, c)} />
              {!isExternal && <ViewRow label={c.bmStatus} value={statusLabel(status, c)} />}
            </div>
            {notes && <ViewRow label={c.bmNotes} value={notes} />}

            {/* Ringkasan total (view) */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 flex items-center justify-between gap-3">
              <span className="text-sm text-gray-600 dark:text-gray-300 min-w-0">
                {c.bmNightsTimes.replace('{nights}', String(nights)).replace('{price}', formatCurrency(price))}
              </span>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums shrink-0">
                {formatCurrency(total)}
              </span>
            </div>
          </div>
        )}

        {/* ── MODE EDIT ──────────────────────────────────────────────────────── */}
        {isEditing && (
        <>
        {/* Tanggal */}
        <div className="grid grid-cols-2 gap-3">
          <FloatingField
            label={c.bmCheckIn}
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            disabled={datesLocked}
          />
          <FloatingField
            label={c.bmCheckOut}
            type="date"
            value={checkOut}
            min={checkIn ? format(addDays(parseISO(checkIn), 1), 'yyyy-MM-dd') : undefined}
            onChange={(e) => setCheckOut(e.target.value)}
            disabled={datesLocked}
          />
        </div>

        {/* Overlap warning */}
        {hasConflict && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800 dark:text-amber-300">
              <p className="font-semibold">{c.bmConflictTitle}</p>
              <ul className="mt-1 space-y-0.5 text-xs">
                {conflicts.slice(0, 3).map((cf) => (
                  <li key={cf.id}>
                    {cf.guest_name || cf.contact?.name || c.bmDefaultBooking} · {cf.check_in} → {cf.check_out}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Tamu — dua field disejajarkan baseline underline-nya (items-end) */}
        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <div className="relative">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{c.bmGuest}</label>
            <ContactAutocomplete
              businessId={businessId}
              value={guestName}
              onChange={(v) => {
                setGuestName(v);
                setContactId(null);
              }}
              onSelectContact={(ct: Contact) => {
                setGuestName(ct.name);
                setContactId(ct.id);
              }}
              placeholder={c.bmGuestPlaceholder}
              className={isExternal ? 'input-underline opacity-60 pointer-events-none' : 'input-underline'}
            />
          </div>
          <div className="w-24">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{c.bmGuestCount}</label>
            <input
              type="number"
              min={1}
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              disabled={isExternal}
              placeholder="—"
              className="input-underline"
            />
          </div>
        </div>

        {/* Harga & total */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FloatingField
              label={c.bmPricePerNight}
              type="text"
              inputMode="numeric"
              value={pricePerNight ? formatNumber(Number(pricePerNight)) : ''}
              onChange={(e) => {
                // Edit manual = keluar dari mode harga-kalender (total kembali flat × malam).
                setAutoQuote(null);
                // Simpan angka mentah; tampilkan dengan pemisah ribuan.
                setPricePerNight(e.target.value.replace(/\D/g, ''));
              }}
              disabled={priceLocked}
            />
            {autoQuote && (
              <p className="mt-1 text-[10px] text-primary-600 dark:text-primary-400">{c.bmAvgAuto}</p>
            )}
          </div>
          <FloatingSelect
            label={c.bmChannel}
            value={channel}
            onChange={(e) => setChannel(e.target.value as BookingChannel)}
            disabled={priceLocked}
          >
            {(['manual', 'airbnb', 'booking_com', 'website', 'other'] as BookingChannel[]).map((ch) => (
              <option key={ch} value={ch}>
                {channelLabel(ch, c)}
              </option>
            ))}
          </FloatingSelect>
        </div>

        {/* Ringkasan total */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 flex items-center justify-between gap-3">
          <span className="text-sm text-gray-600 dark:text-gray-300 min-w-0">
            {autoQuote && quoteBreakdownLabel
              ? quoteBreakdownLabel
              : c.bmNightsTimes.replace('{nights}', String(nights)).replace('{price}', formatCurrency(price))}
            {autoQuote && (
              <span className="block text-xs text-primary-600 dark:text-primary-400 mt-0.5">
                {c.bmAutoFromCalendar}
              </span>
            )}
          </span>
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums shrink-0">
            {formatCurrency(total)}
          </span>
        </div>

        {/* Status editable (existing) */}
        {booking && !isExternal && (
          <FloatingSelect
            label={c.bmStatus}
            value={status}
            onChange={(e) =>
              isPaid
                ? handleStatusUpdate(e.target.value as BookingStatus)
                : setStatus(e.target.value as BookingStatus)
            }
          >
            {EDITABLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s, c)}
              </option>
            ))}
          </FloatingSelect>
        )}

        {/* Notes */}
        {!isExternal && (
          <div>
            <label className="label">{c.bmNotes}</label>
            <textarea
              className="input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={c.bmNotesPlaceholder}
            />
          </div>
        )}
        </>
        )}

        {/* Pembayaran (existing, unpaid, non-external) — muncul di view & edit
            karena ini AKSI (menandai lunas), bukan field yg diedit. */}
        {booking && !isExternal && !isPaid && (
          <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{c.bmReceivePayment}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{c.bmReceivePaymentDesc}</p>
              </div>
              <SegmentedToggle
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={[
                  { value: 'cash', label: c.bmCash },
                  { value: 'qris', label: c.bmQris },
                ]}
                ariaLabel={c.bmPaymentMethod}
              />
            </div>
            <button
              type="button"
              onClick={handleMarkPaid}
              disabled={busy || total <= 0 || !datesValid || hasConflict}
              className="btn-primary-glow w-full mt-3 inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {c.bmMarkPaid.replace('{total}', formatCurrency(total))}
            </button>
          </div>
        )}

        {/* Aksi hapus / batalkan (existing) */}
        {booking && (
          <div className="flex items-center gap-4 pt-1">
            {!isExternal && booking.status !== 'cancelled' && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-50"
              >
                <Ban className="w-4 h-4" /> {c.bmCancelBooking}
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> {c.bmDelete}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Baris read-only (mode view): label kecil di atas, nilai di bawah. */
function ViewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">{value}</p>
    </div>
  );
}
