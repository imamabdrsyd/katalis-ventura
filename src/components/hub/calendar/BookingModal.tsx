'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { differenceInCalendarDays, parseISO, format, addDays } from 'date-fns';
import { AlertTriangle, Loader2, Trash2, Ban, CheckCircle2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import type {
  Account,
  Booking,
  BookingChannel,
  BookingInsert,
  BookingStatus,
  BookingUpdate,
  CatalogItem,
  Contact,
} from '@/types';
import type { PaymentMethod } from '@/lib/accounting/salesCheckout';
import { Modal } from '@/components/ui/Modal';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { ContactAutocomplete } from '@/components/transactions/ContactAutocomplete';
import { formatCurrency } from '@/lib/utils';
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
  catalog_item_id?: string;
  guest_name?: string;
  channel?: BookingChannel;
}

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  units: CatalogItem[];
  accounts: Account[];
  /** Booking yang diedit; null = mode buat baru. */
  booking: Booking | null;
  prefill?: BookingPrefill | null;
  onCreate: (insert: Omit<BookingInsert, 'business_id' | 'created_by'>) => Promise<unknown>;
  onUpdate: (id: string, updates: BookingUpdate) => Promise<unknown>;
  onMarkPaid: (booking: Booking, method: PaymentMethod) => Promise<unknown>;
  onCancel: (id: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  checkOverlap: (
    catalogItemId: string,
    checkIn: string,
    checkOut: string,
    excludeId?: string
  ) => Promise<Booking[]>;
}

const EDITABLE_STATUSES: BookingStatus[] = ['tentative', 'confirmed', 'checked_in', 'completed'];

export function BookingModal({
  isOpen,
  onClose,
  businessId,
  units,
  accounts,
  booking,
  prefill,
  onCreate,
  onUpdate,
  onMarkPaid,
  onCancel,
  onDelete,
  checkOverlap,
}: BookingModalProps) {
  const isEdit = !!booking;
  const isExternal = !!booking?.is_external;
  const isPaid = booking?.payment_status === 'paid';
  const locked = isExternal || isPaid; // unit/tanggal/harga tak bisa diubah

  // ── Form state ────────────────────────────────────────────────────────────
  const [unitId, setUnitId] = useState('');
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

  // Reset form saat modal dibuka / target berubah
  useEffect(() => {
    if (!isOpen) return;
    if (booking) {
      setUnitId(booking.catalog_item_id ?? '');
      setCheckIn(booking.check_in);
      setCheckOut(booking.check_out);
      setGuestName(booking.guest_name ?? booking.contact?.name ?? '');
      setContactId(booking.contact_id ?? null);
      setGuestCount(booking.guest_count != null ? String(booking.guest_count) : '');
      setPricePerNight(String(booking.price_per_night));
      setChannel(booking.channel);
      setStatus(booking.status);
      setNotes(booking.notes ?? '');
    } else {
      const firstUnit = prefill?.catalog_item_id ?? units[0]?.id ?? '';
      setUnitId(firstUnit);
      setCheckIn(prefill?.check_in ?? format(new Date(), 'yyyy-MM-dd'));
      setCheckOut(prefill?.check_out ?? format(addDays(new Date(), 1), 'yyyy-MM-dd'));
      setGuestName(prefill?.guest_name ?? '');
      setContactId(null);
      setGuestCount('');
      const price = units.find((u) => u.id === firstUnit)?.default_price ?? 0;
      setPricePerNight(String(price));
      setChannel(prefill?.channel ?? 'manual');
      setStatus('confirmed');
      setNotes('');
    }
    setPaymentMethod('cash');
    setConflicts([]);
  }, [isOpen, booking, prefill, units]);

  // Saat pilih unit di mode buat → auto-isi harga dari default_price unit
  const handleUnitChange = useCallback(
    (id: string) => {
      setUnitId(id);
      if (!isEdit) {
        const price = units.find((u) => u.id === id)?.default_price ?? 0;
        setPricePerNight(String(price));
      }
    },
    [isEdit, units]
  );

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    try {
      return Math.max(0, differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn)));
    } catch {
      return 0;
    }
  }, [checkIn, checkOut]);

  const price = Number(pricePerNight) || 0;
  const total = nights * price;
  const datesValid = nights > 0;

  // ── Overlap guard (debounced) ──────────────────────────────────────────────
  useEffect(() => {
    if (locked || !unitId || !datesValid) {
      setConflicts([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await checkOverlap(unitId, checkIn, checkOut, booking?.id);
        if (!cancelled) setConflicts(res);
      } catch {
        if (!cancelled) setConflicts([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [locked, unitId, checkIn, checkOut, datesValid, checkOverlap, booking?.id]);

  const hasConflict = conflicts.length > 0;

  // ── Actions ─────────────────────────────────────────────────────────────────
  const buildBase = () => ({
    catalog_item_id: unitId || null,
    contact_id: contactId,
    check_in: checkIn,
    check_out: checkOut,
    price_per_night: price,
    total_amount: total,
    guest_name: guestName.trim() || null,
    guest_count: guestCount ? Number(guestCount) : null,
    channel,
    status,
    // Menyimpan booking = mengkonfirmasi tanggal → buang flag perkiraan.
    date_estimated: false,
    notes: notes.trim() || null,
  });

  const handleSubmit = async () => {
    if (!unitId) return toast.error('Pilih unit/kamar dulu.');
    if (!datesValid) return toast.error('Tanggal check-out harus setelah check-in.');
    if (hasConflict) return toast.error('Tanggal bentrok dengan booking lain untuk unit ini.');
    setBusy(true);
    try {
      if (isEdit && booking) {
        await onUpdate(booking.id, buildBase());
        toast.success('Booking diperbarui');
      } else {
        await onCreate(buildBase());
        toast.success('Booking dibuat');
      }
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
    if (total <= 0) return toast.error('Total booking harus lebih dari 0.');
    setBusy(true);
    try {
      await onMarkPaid(booking, paymentMethod);
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

  const title = isExternal
    ? 'Blok ketersediaan (OTA)'
    : isEdit
      ? 'Detail booking'
      : 'Booking baru';

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <button type="button" onClick={onClose} className="btn-ghost">
        Tutup
      </button>
      {!locked && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy || hasConflict || !datesValid || !unitId}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {isEdit ? 'Simpan perubahan' : 'Simpan booking'}
        </button>
      )}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg" footer={footer}>
      <div className="space-y-4">
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

        {/* Tanggal perkiraan (hasil backfill) */}
        {booking?.date_estimated && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Tanggal ini <b>perkiraan</b> (dari tanggal transaksi). Sesuaikan check-in/check-out
              yang benar lalu <b>Simpan perubahan</b>.
            </p>
          </div>
        )}

        {/* Unit */}
        <div>
          <label className="label">Unit / kamar</label>
          <select
            className="input"
            value={unitId}
            onChange={(e) => handleUnitChange(e.target.value)}
            disabled={locked}
          >
            <option value="">— pilih unit —</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.default_price ? ` — ${formatCurrency(u.default_price)}/${u.unit || 'malam'}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Tanggal */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Check-in</label>
            <input
              type="date"
              className="input"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              disabled={locked}
            />
          </div>
          <div>
            <label className="label">Check-out</label>
            <input
              type="date"
              className="input"
              value={checkOut}
              min={checkIn ? format(addDays(parseISO(checkIn), 1), 'yyyy-MM-dd') : undefined}
              onChange={(e) => setCheckOut(e.target.value)}
              disabled={locked}
            />
          </div>
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
              className={locked ? 'input opacity-60 pointer-events-none' : 'input'}
            />
          </div>
          <div className="w-24">
            <label className="label">Tamu (org)</label>
            <input
              type="number"
              min={1}
              className="input"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              placeholder="—"
              disabled={isExternal}
            />
          </div>
        </div>

        {/* Harga & total */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Harga / malam</label>
            <input
              type="number"
              min={0}
              className="input"
              value={pricePerNight}
              onChange={(e) => setPricePerNight(e.target.value)}
              disabled={locked}
            />
          </div>
          <div>
            <label className="label">Channel</label>
            <select
              className="input"
              value={channel}
              onChange={(e) => setChannel(e.target.value as BookingChannel)}
              disabled={locked}
            >
              {(Object.keys(BOOKING_CHANNEL_LABELS) as BookingChannel[]).map((c) => (
                <option key={c} value={c}>
                  {BOOKING_CHANNEL_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Ringkasan total */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {nights} malam × {formatCurrency(price)}
          </span>
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">
            {formatCurrency(total)}
          </span>
        </div>

        {/* Status editable (existing) */}
        {isEdit && !isExternal && (
          <div>
            <label className="label">Status</label>
            <select
              className="input"
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
            </select>
          </div>
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
        {isEdit && !isExternal && !isPaid && (
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
              disabled={busy || total <= 0}
              className="btn-primary-glow w-full mt-3 inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Tandai Lunas · {formatCurrency(total)}
            </button>
          </div>
        )}

        {/* Aksi hapus / batalkan (existing) */}
        {isEdit && booking && (
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
