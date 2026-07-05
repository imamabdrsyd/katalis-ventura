import { createClient } from '@/lib/supabase';
import type { Account, Booking, BookingInsert, BookingUpdate } from '@/types';
import { createMultiLineTransaction, deleteTransaction } from '@/lib/api/transactions';
import { saveContactFromTransaction } from '@/lib/api/contacts';
import {
  resolveCashAccount,
  resolveDefaultRevenueAccount,
  type PaymentMethod,
} from '@/lib/accounting/salesCheckout';

const SELECT_WITH_RELATIONS = `
  *,
  unit:business_units!bookings_unit_id_fkey(*, rate_item:catalog_items!business_units_rate_item_id_fkey(*)),
  contact:business_contacts!bookings_contact_id_fkey(*)
`;

/**
 * Petakan error Postgres ke pesan ramah. 23P01 = exclusion constraint
 * `bookings_no_double_booking` (migr 117) — backstop server-side untuk race
 * yang lolos cek overlap client (findOverlappingBookings, debounced).
 */
function toFriendlyBookingError(error: { code?: string; message: string }): Error {
  if (error.code === '23P01' || error.message.includes('bookings_no_double_booking')) {
    return new Error('Tanggal bentrok dengan booking lain untuk unit ini (double-booking dicegah).');
  }
  return new Error(error.message);
}

/**
 * Ambil booking yang beririsan dengan rentang [from, to) (inklusif from, eksklusif to),
 * di-scope ke satu unit fisik (tiap unit punya kalendernya sendiri). Booking
 * beririsan bila check_in < to AND check_out > from. Termasuk yang
 * cancelled/external agar board bisa menampilkannya; caller yang memfilter.
 */
export async function getBookingsForRange(
  businessId: string,
  unitId: string,
  from: string,
  to: string
): Promise<Booking[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('bookings')
    .select(SELECT_WITH_RELATIONS)
    .eq('business_id', businessId)
    .eq('unit_id', unitId)
    .is('deleted_at', null)
    .lt('check_in', to)
    .gt('check_out', from)
    .order('check_in', { ascending: true });

  if (error) throw new Error(error.message);
  return data as Booking[];
}

/**
 * Ambil booking di PENAMPUNGAN — check_in/check_out belum diisi (hasil flag
 * transaksi EARN yang tak punya tanggal). Ditampilkan di panel "Perlu tindak
 * lanjut" agar owner melengkapi tanggalnya. Di-scope per unit.
 */
export async function getPendingBookings(businessId: string, unitId: string): Promise<Booking[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('bookings')
    .select(SELECT_WITH_RELATIONS)
    .eq('business_id', businessId)
    .eq('unit_id', unitId)
    .is('deleted_at', null)
    .is('check_in', null)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data as Booking[];
}

/**
 * Hitung transaksi EARN "stay" yang belum tertaut ke booking — untuk banner
 * "Tarik ke kalender". Kriteria disamakan dengan `reconcileStayTransactions`:
 * punya meta.nights ATAU meta.check_in, belum punya meta.booking_id, bukan settlement.
 */
export async function countUnlinkedStayTransactions(businessId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('category', 'EARN')
    .is('deleted_at', null)
    .or('meta->nights.not.is.null,meta->check_in.not.is.null')
    .is('meta->booking_id', null)
    .is('meta->settlement_of_transaction_id', null)
    .is('meta->settlement_amount', null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getBookingById(id: string): Promise<Booking | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('bookings')
    .select(SELECT_WITH_RELATIONS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as Booking) ?? null;
}

export async function createBooking(insert: BookingInsert): Promise<Booking> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('bookings')
    .insert(insert)
    .select(SELECT_WITH_RELATIONS)
    .single();

  if (error) throw toFriendlyBookingError(error);
  return data as Booking;
}

/** Channel booking dari sales_channel/platform transaksi. */
function channelFromTransaction(salesChannel: string | null | undefined, meta: Record<string, unknown>): Booking['channel'] {
  if (salesChannel === 'airbnb') return 'airbnb';
  if (salesChannel === 'booking_com') return 'booking_com';
  if (salesChannel === 'website') return 'website';
  const platform = typeof meta.platform === 'string' ? meta.platform.toLowerCase() : '';
  if (platform.includes('airbnb')) return 'airbnb';
  if (platform.includes('booking')) return 'booking_com';
  return salesChannel ? 'other' : 'manual';
}

/**
 * Buat booking dari transaksi EARN yang di-flag user ("Masukkan ke kalender").
 * Booking masuk **berstatus LUNAS** (revenue sudah tercatat di ledger) dan ke
 * **PENAMPUNGAN** (check_in/check_out NULL) karena transaksi tak punya tanggal
 * menginap — owner melengkapi tanggal di halaman kalender. Data yang di-agregat:
 * **nama, harga (amount), channel**. Idempoten: bila transaksi sudah punya
 * booking (meta.booking_id / booking ber-transaction_id), kembalikan yg ada.
 */
export async function createBookingFromTransaction(
  txn: {
    id: string;
    business_id: string;
    name: string | null;
    amount: number;
    sales_channel?: string | null;
    meta?: Record<string, unknown> | null;
  },
  unitId: string,
  userId: string
): Promise<Booking> {
  const supabase = createClient();

  // Idempoten: sudah ada booking untuk transaksi ini?
  const { data: existing } = await supabase
    .from('bookings')
    .select(SELECT_WITH_RELATIONS)
    .eq('transaction_id', txn.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (existing) return existing as Booking;

  const meta = (txn.meta ?? {}) as Record<string, unknown>;
  const amount = Number(txn.amount) || 0;
  // Kalau transaksi kebetulan punya tanggal di meta (mis. impor OTA), pakai —
  // booking langsung "keluar" dari penampungan. Selain itu NULL (holding).
  const checkIn = typeof meta.check_in === 'string' ? (meta.check_in as string) : null;
  const checkOut = typeof meta.check_out === 'string' ? (meta.check_out as string) : null;
  const nightsMeta = typeof meta.nights === 'number' ? (meta.nights as number) : null;
  const hasDates = !!checkIn && !!checkOut;
  const pricePerNight = hasDates && nightsMeta && nightsMeta > 0 ? Math.round(amount / nightsMeta) : amount;

  const booking = await createBooking({
    business_id: txn.business_id,
    unit_id: unitId,
    transaction_id: txn.id,
    check_in: hasDates ? checkIn : null,
    check_out: hasDates ? checkOut : null,
    price_per_night: pricePerNight,
    total_amount: amount,
    guest_name: txn.name || 'Tamu',
    status: 'confirmed',
    payment_status: 'paid',
    channel: channelFromTransaction(txn.sales_channel, meta),
    is_external: false,
    date_estimated: false,
    notes: hasDates ? null : 'Perlu isi tanggal check-in/out.',
    created_by: userId,
  });

  // Link balik ke transaksi (merge meta.booking_id).
  await supabase
    .from('transactions')
    .update({ meta: { ...meta, booking_id: booking.id } })
    .eq('id', txn.id);

  return booking;
}

export async function updateBooking(id: string, updates: BookingUpdate): Promise<Booking> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .select(SELECT_WITH_RELATIONS)
    .single();

  if (error) throw toFriendlyBookingError(error);
  return data as Booking;
}

/** Batalkan booking (status → cancelled, record tetap ada untuk histori). */
export async function cancelBooking(id: string): Promise<Booking> {
  return updateBooking(id, { status: 'cancelled' });
}

/** Soft-delete booking (buang dari board). */
export async function deleteBooking(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('bookings')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Cari booking yang beririsan tanggal untuk unit fisik yang sama — proteksi
 * double-booking. Mengabaikan booking cancelled & (opsional) diri sendiri.
 * Dua rentang [aIn,aOut) & [bIn,bOut) beririsan jika aIn < bOut AND aOut > bIn.
 */
export async function findOverlappingBookings(
  businessId: string,
  unitId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string
): Promise<Booking[]> {
  const supabase = createClient();
  let query = supabase
    .from('bookings')
    .select(SELECT_WITH_RELATIONS)
    .eq('business_id', businessId)
    .eq('unit_id', unitId)
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .lt('check_in', checkOut)
    .gt('check_out', checkIn);

  if (excludeBookingId) query = query.neq('id', excludeBookingId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as Booking[];
}

/**
 * Tandai booking LUNAS: rakit transaksi EARN multi-line (Dr Kas/Bank, Cr Pendapatan)
 * lalu tautkan ke booking (transaction_id + payment_status='paid'). Pola identik
 * dengan POS `useCashier.checkout()`. Mengembalikan booking terbaru.
 *
 * Melempar bila booking eksternal/sudah lunas, atau akun kas/pendapatan tak ada.
 * Tidak atomik (2 langkah HTTP) — dimitigasi: state booking di-re-fetch dulu
 * (tolak yang sudah lunas dari sesi lain), dan bila penautan gagal transaksi
 * EARN yang telanjur dibuat di-soft-delete (kompensasi) agar retry tidak
 * menggandakan pendapatan.
 */
export async function markBookingPaid(
  booking: Booking,
  opts: { method: PaymentMethod; accounts: Account[]; userId: string }
): Promise<Booking> {
  const { method, accounts, userId } = opts;

  // Re-fetch state terbaru — hindari stale client (dua tab / sudah dilunasi
  // sesi lain / sudah dihapus) sebelum menulis ke ledger.
  const fresh = await getBookingById(booking.id);
  if (!fresh) throw new Error('Booking tidak ditemukan (mungkin sudah dihapus).');

  if (fresh.is_external) throw new Error('Booking impor OTA tidak bisa ditandai lunas.');
  if (fresh.payment_status === 'paid' && fresh.transaction_id) {
    throw new Error('Booking sudah lunas.');
  }
  if (!fresh.check_in || !fresh.check_out) {
    throw new Error('Isi tanggal check-in/check-out dulu sebelum menandai lunas.');
  }

  const cashAccount = resolveCashAccount(accounts, method);
  if (!cashAccount) {
    throw new Error('Akun Kas/Bank tidak ditemukan. Periksa Chart of Accounts.');
  }

  const revenueAccountId =
    fresh.unit?.rate_item?.revenue_account_id ?? resolveDefaultRevenueAccount(accounts)?.id ?? null;
  if (!revenueAccountId) {
    throw new Error('Akun pendapatan tidak ditemukan. Set sumber harga pada unit atau akun pendapatan default di CoA.');
  }

  const total = fresh.total_amount;
  const unitName = fresh.unit?.name ?? 'Unit';
  const guestName = fresh.guest_name?.trim() || fresh.contact?.name || 'Tamu';
  const stayLabel = `${fresh.check_in} s/d ${fresh.check_out}`;

  const created = await createMultiLineTransaction({
    business_id: fresh.business_id,
    created_by: userId,
    date: new Date().toISOString().slice(0, 10),
    category: 'EARN',
    name: guestName,
    description: `Booking ${unitName} — ${fresh.nights} malam (${stayLabel})`,
    status: 'posted',
    sales_channel: mapChannelToSalesChannel(fresh.channel),
    meta: {
      source: 'calendar_booking',
      booking_id: fresh.id,
      payment_method: method,
      unit_breakdown: {
        price_per_unit: fresh.price_per_night,
        quantity: fresh.nights,
        unit: 'malam',
      },
    },
    journal_lines: [
      {
        account_id: cashAccount.id,
        debit_amount: total,
        credit_amount: 0,
        description: method === 'cash' ? 'Penerimaan tunai' : 'Penerimaan QRIS',
        sort_order: 0,
      },
      {
        account_id: revenueAccountId,
        debit_amount: 0,
        credit_amount: total,
        description: `Pendapatan booking — ${unitName}`,
        sort_order: 1,
      },
    ],
  });

  let updated: Booking;
  try {
    updated = await updateBooking(fresh.id, {
      transaction_id: created.id,
      payment_status: 'paid',
      // Booking yang sudah dibayar minimal berstatus confirmed.
      status: fresh.status === 'tentative' ? 'confirmed' : fresh.status,
    });
  } catch (err) {
    // Kompensasi: transaksi EARN sudah tercatat tapi gagal ditautkan ke booking
    // — batalkan (soft-delete) supaya retry tidak menggandakan pendapatan.
    const reason = err instanceof Error ? err.message : 'unknown';
    try {
      await deleteTransaction(created.id);
    } catch (cleanupErr) {
      console.error('Gagal membatalkan transaksi orphan:', cleanupErr);
      throw new Error(
        `Gagal menautkan pembayaran ke booking dan transaksi yang telanjur tercatat belum terbatalkan — cek halaman Transaksi (cari "${guestName}") sebelum mencoba lagi. (${reason})`
      );
    }
    throw new Error(
      `Gagal menautkan pembayaran ke booking — transaksi dibatalkan otomatis, silakan coba lagi. (${reason})`
    );
  }

  // Simpan tamu sebagai kontak (best-effort — tak membatalkan pembayaran tercatat).
  if (fresh.guest_name?.trim()) {
    try {
      await saveContactFromTransaction(fresh.business_id, fresh.guest_name.trim(), 'customer', userId);
    } catch (err) {
      console.error('Gagal simpan kontak tamu:', err);
    }
  }

  return updated;
}

/** Map channel booking → sales_channel transaksi (subset yang cocok). */
function mapChannelToSalesChannel(channel: Booking['channel']) {
  switch (channel) {
    case 'airbnb':
      return 'airbnb' as const;
    case 'booking_com':
      return 'booking_com' as const;
    case 'manual':
      return 'offline' as const;
    default:
      return 'other' as const;
  }
}
