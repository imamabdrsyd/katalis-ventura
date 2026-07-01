import { createClient } from '@/lib/supabase';
import type { Account, Booking, BookingInsert, BookingUpdate } from '@/types';
import { createMultiLineTransaction } from '@/lib/api/transactions';
import { saveContactFromTransaction } from '@/lib/api/contacts';
import {
  resolveCashAccount,
  resolveDefaultRevenueAccount,
  type PaymentMethod,
} from '@/lib/accounting/salesCheckout';

const SELECT_WITH_RELATIONS = `
  *,
  catalog_item:catalog_items!bookings_catalog_item_id_fkey(*),
  contact:business_contacts!bookings_contact_id_fkey(*)
`;

/**
 * Ambil booking yang beririsan dengan rentang [from, to) (inklusif from, eksklusif to).
 * Booking beririsan bila check_in < to AND check_out > from. Termasuk yang
 * cancelled/external agar board bisa menampilkannya; caller yang memfilter.
 */
export async function getBookingsForRange(
  businessId: string,
  from: string,
  to: string
): Promise<Booking[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('bookings')
    .select(SELECT_WITH_RELATIONS)
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .lt('check_in', to)
    .gt('check_out', from)
    .order('check_in', { ascending: true });

  if (error) throw new Error(error.message);
  return data as Booking[];
}

/** Ambil semua booking mendatang (check_out >= hari ini) — dipakai fitur AI availability & KPI. */
export async function getUpcomingBookings(
  businessId: string,
  fromDate: string
): Promise<Booking[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('bookings')
    .select(SELECT_WITH_RELATIONS)
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .gte('check_out', fromDate)
    .order('check_in', { ascending: true });

  if (error) throw new Error(error.message);
  return data as Booking[];
}

/**
 * Hitung transaksi EARN "stay" yang belum tertaut ke booking (punya meta.nights,
 * belum punya meta.booking_id, bukan settlement) — untuk banner "Tarik ke kalender".
 */
export async function countUnlinkedStayTransactions(businessId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('category', 'EARN')
    .is('deleted_at', null)
    .not('meta->nights', 'is', null)
    .is('meta->booking_id', null)
    .is('meta->settlement_of_transaction_id', null);

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

  if (error) throw new Error(error.message);
  return data as Booking;
}

export async function updateBooking(id: string, updates: BookingUpdate): Promise<Booking> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .select(SELECT_WITH_RELATIONS)
    .single();

  if (error) throw new Error(error.message);
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
 * Cari booking yang beririsan tanggal untuk unit (catalog_item) yang sama —
 * proteksi double-booking. Mengabaikan booking cancelled & (opsional) diri sendiri.
 * Dua rentang [aIn,aOut) & [bIn,bOut) beririsan jika aIn < bOut AND aOut > bIn.
 */
export async function findOverlappingBookings(
  businessId: string,
  catalogItemId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string
): Promise<Booking[]> {
  const supabase = createClient();
  let query = supabase
    .from('bookings')
    .select(SELECT_WITH_RELATIONS)
    .eq('business_id', businessId)
    .eq('catalog_item_id', catalogItemId)
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
 */
export async function markBookingPaid(
  booking: Booking,
  opts: { method: PaymentMethod; accounts: Account[]; userId: string }
): Promise<Booking> {
  const { method, accounts, userId } = opts;

  if (booking.is_external) throw new Error('Booking impor OTA tidak bisa ditandai lunas.');
  if (booking.payment_status === 'paid' && booking.transaction_id) {
    throw new Error('Booking sudah lunas.');
  }

  const cashAccount = resolveCashAccount(accounts, method);
  if (!cashAccount) {
    throw new Error('Akun Kas/Bank tidak ditemukan. Periksa Chart of Accounts.');
  }

  const revenueAccountId =
    booking.catalog_item?.revenue_account_id ?? resolveDefaultRevenueAccount(accounts)?.id ?? null;
  if (!revenueAccountId) {
    throw new Error('Akun pendapatan tidak ditemukan. Set akun pendapatan pada unit atau CoA.');
  }

  const total = booking.total_amount;
  const unitName = booking.catalog_item?.name ?? 'Unit';
  const guestName = booking.guest_name?.trim() || booking.contact?.name || 'Tamu';
  const stayLabel = `${booking.check_in} s/d ${booking.check_out}`;

  const created = await createMultiLineTransaction({
    business_id: booking.business_id,
    created_by: userId,
    date: new Date().toISOString().slice(0, 10),
    category: 'EARN',
    name: guestName,
    description: `Booking ${unitName} — ${booking.nights} malam (${stayLabel})`,
    status: 'posted',
    sales_channel: mapChannelToSalesChannel(booking.channel),
    meta: {
      source: 'calendar_booking',
      booking_id: booking.id,
      payment_method: method,
      unit_breakdown: {
        price_per_unit: booking.price_per_night,
        quantity: booking.nights,
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

  const updated = await updateBooking(booking.id, {
    transaction_id: created.id,
    payment_status: 'paid',
    // Booking yang sudah dibayar minimal berstatus confirmed.
    status: booking.status === 'tentative' ? 'confirmed' : booking.status,
  });

  // Simpan tamu sebagai kontak (best-effort — tak membatalkan pembayaran tercatat).
  if (booking.guest_name?.trim()) {
    try {
      await saveContactFromTransaction(booking.business_id, booking.guest_name.trim(), 'customer', userId);
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
