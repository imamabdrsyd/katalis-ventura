'use client';

import { useState, useEffect, useMemo } from 'react';
import { differenceInCalendarDays, parseISO, format, addDays } from 'date-fns';
import { AlertTriangle, Loader2, Trash2, Ban, CheckCircle2, ExternalLink, Home } from 'lucide-react';
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
import { formatCurrency } from '@/lib/utils';
import { getDailyRates } from '@/lib/api/dailyRates';
import { quoteStay, groupIntoRanges, type StayQuote } from '@/lib/rates';
import {
  BOOKING_STATUS_LABELS,
  BOOKING_CHANNEL_LABELS,
  getBookingDisplayState,
  BOOKING_STATE_LABELS,
  BOOKING_DOT_CLASSES,
} from '@/lib/bookingStatus';

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
  booking,
  onUpdate,
  onMarkPaid,
  onCancel,
  onDelete,
  checkOverlap,
}: BookingModalProps) {
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

  // ── Auto-quote kalender harga — hanya untuk booking BELUM lunas (mis. tentatif
  // dari website) yang harganya masih boleh dihitung ulang dari kalender harga.
  const rateQuoteActive = !priceLocked && !!unit.rate_item_id;
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
        const q = quoteStay(
          checkIn,
          checkOut,
          Number(unit.rate_item?.default_price ?? 0),
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
  }, [rateQuoteActive, datesValid, unit.id, unit.rate_item?.default_price, checkIn, checkOut]);

  // Ringkasan breakdown per rentang harga ("2 mlm × 350rb + 1 mlm × 750rb").
  const quoteBreakdownLabel = useMemo(() => {
    if (!autoQuote) return null;
    return groupIntoRanges(autoQuote.breakdown)
      .map((r) => `${r.nights} mlm × ${formatCurrency(r.price)}`)
      .join(' + ');
  }, [autoQuote]);

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
    if (!datesValid) return toast.error('Tanggal check-out harus setelah check-in.');
    if (hasConflict) return toast.error('Tanggal bentrok dengan booking lain untuk unit ini.');
    setBusy(true);
    try {
      await onUpdate(booking.id, buildBase());
      toast.success('Booking diperbarui');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan booking');
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
      toast.success('Status diperbarui');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memperbarui status');
    } finally {
      setBusy(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!booking) return;
    if (!datesValid) return toast.error('Tanggal check-out harus setelah check-in.');
    if (hasConflict) return toast.error('Tanggal bentrok dengan booking lain untuk unit ini.');
    if (total <= 0) return toast.error('Total booking harus lebih dari 0.');
    setBusy(true);
    try {
      // Simpan nilai form dulu (harga/tanggal/status) supaya ledger mencatat
      // angka yang tampil di tombol — bukan snapshot booking sebelum diedit.
      const saved = await onUpdate(booking.id, buildBase());
      await onMarkPaid(saved, paymentMethod);
      toast.success('Booking ditandai lunas — transaksi tercatat di pembukuan');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menandai lunas');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!booking) return;
    setBusy(true);
    try {
      await onCancel(booking.id);
      toast.success('Booking dibatalkan');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membatalkan');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!booking) return;
    setBusy(true);
    try {
      await onDelete(booking.id);
      toast.success('Booking dihapus');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus');
    } finally {
      setBusy(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const displayState = booking ? getBookingDisplayState(booking) : null;

  const title = isExternal ? 'Blok ketersediaan (OTA)' : 'Detail booking';

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <button type="button" onClick={onClose} className="btn-ghost">
        Tutup
      </button>
      {!isExternal && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy || hasConflict || !datesValid}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Simpan perubahan
        </button>
      )}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg" footer={footer}>
      <div className="space-y-5">
        {/* Unit (fixed — kalender ini scoped ke satu unit) */}
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <Home className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          Booking untuk unit: <span className="font-semibold text-gray-900 dark:text-gray-100">{unit.name}</span>
        </div>

        {/* Status + channel badge (edit) */}
        {booking && displayState && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
              <span className={`w-2 h-2 rounded-full ${BOOKING_DOT_CLASSES[displayState]}`} />
              {BOOKING_STATE_LABELS[displayState]}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              via {BOOKING_CHANNEL_LABELS[booking.channel]}
            </span>
            {isPaid && booking.transaction_id && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Tercatat di pembukuan
              </span>
            )}
          </div>
        )}

        {/* External read-only note */}
        {isExternal && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 flex items-start gap-3">
            <ExternalLink className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Blok ini diimpor dari kalender {BOOKING_CHANNEL_LABELS[channel]} (iCal) sebagai
              penanda ketersediaan. Tidak bisa diedit atau ditandai lunas dari sini.
            </p>
          </div>
        )}

        {/* Booking lunas dari transaksi (revenue terkunci) */}
        {isPaid && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-3 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-sm text-emerald-800 dark:text-emerald-300">
              Booking ini <b>sudah lunas</b> — nilainya terkunci ke transaksi di pembukuan. Kamu
              masih bisa menyesuaikan tanggal, tamu, dan catatan.
            </p>
          </div>
        )}

        {/* Tanggal */}
        <div className="grid grid-cols-2 gap-3">
          <FloatingField
            label="Check-in"
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            disabled={datesLocked}
          />
          <FloatingField
            label="Check-out"
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
              <p className="font-semibold">Tanggal bentrok untuk unit ini</p>
              <ul className="mt-1 space-y-0.5 text-xs">
                {conflicts.slice(0, 3).map((c) => (
                  <li key={c.id}>
                    {c.guest_name || c.contact?.name || 'Booking'} · {c.check_in} → {c.check_out}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Tamu */}
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div>
            <label className="label">Tamu</label>
            <ContactAutocomplete
              businessId={businessId}
              value={guestName}
              onChange={(v) => {
                setGuestName(v);
                setContactId(null);
              }}
              onSelectContact={(c: Contact) => {
                setGuestName(c.name);
                setContactId(c.id);
              }}
              placeholder="Nama tamu"
              className={isExternal ? 'input-underline opacity-60 pointer-events-none' : 'input-underline'}
            />
          </div>
          <div className="w-24">
            <FloatingField
              label="Tamu (org)"
              type="number"
              min={1}
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              disabled={isExternal}
            />
          </div>
        </div>

        {/* Harga & total */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FloatingField
              label="Harga / malam"
              type="number"
              min={0}
              value={pricePerNight}
              onChange={(e) => {
                // Edit manual = keluar dari mode harga-kalender (total kembali flat × malam).
                setAutoQuote(null);
                setPricePerNight(e.target.value);
              }}
              disabled={priceLocked}
            />
            {autoQuote && (
              <p className="mt-1 text-[10px] text-primary-600 dark:text-primary-400">
                rata-rata · otomatis
              </p>
            )}
          </div>
          <FloatingSelect
            label="Channel"
            value={channel}
            onChange={(e) => setChannel(e.target.value as BookingChannel)}
            disabled={priceLocked}
          >
            {(Object.keys(BOOKING_CHANNEL_LABELS) as BookingChannel[]).map((c) => (
              <option key={c} value={c}>
                {BOOKING_CHANNEL_LABELS[c]}
              </option>
            ))}
          </FloatingSelect>
        </div>

        {/* Ringkasan total */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 flex items-center justify-between gap-3">
          <span className="text-sm text-gray-600 dark:text-gray-300 min-w-0">
            {autoQuote && quoteBreakdownLabel ? quoteBreakdownLabel : `${nights} malam × ${formatCurrency(price)}`}
            {autoQuote && (
              <span className="block text-xs text-primary-600 dark:text-primary-400 mt-0.5">
                harga otomatis dari kalender harga
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
            label="Status"
            value={status}
            onChange={(e) =>
              isPaid
                ? handleStatusUpdate(e.target.value as BookingStatus)
                : setStatus(e.target.value as BookingStatus)
            }
          >
            {EDITABLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {BOOKING_STATUS_LABELS[s]}
              </option>
            ))}
          </FloatingSelect>
        )}

        {/* Notes */}
        {!isExternal && (
          <div>
            <label className="label">Catatan</label>
            <textarea
              className="input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Permintaan khusus, jam kedatangan, dll."
            />
          </div>
        )}

        {/* Pembayaran (existing, unpaid, non-external) */}
        {booking && !isExternal && !isPaid && (
          <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  Terima pembayaran
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Membuat transaksi pendapatan otomatis di pembukuan.
                </p>
              </div>
              <SegmentedToggle
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={[
                  { value: 'cash', label: 'Tunai' },
                  { value: 'qris', label: 'QRIS' },
                ]}
                ariaLabel="Metode pembayaran"
              />
            </div>
            <button
              type="button"
              onClick={handleMarkPaid}
              disabled={busy || total <= 0 || !datesValid || hasConflict}
              className="btn-primary-glow w-full mt-3 inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Tandai Lunas · {formatCurrency(total)}
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
                <Ban className="w-4 h-4" /> Batalkan booking
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> Hapus
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
