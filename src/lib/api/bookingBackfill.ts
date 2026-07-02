/**
 * Rekonsiliasi transaksi revenue menginap (EARN) ↔ bookings (server, admin).
 *
 * Membuat booking terhubung untuk setiap transaksi EARN "stay" yang belum punya
 * booking, supaya revenue yang sudah tercatat di ledger muncul di kalender:
 *   - Presisi  : transaksi punya meta.check_in + check_out.
 *   - Perkiraan: transaksi hanya punya meta.nights → check-in di-default ke
 *     tanggal transaksi, ditandai date_estimated=true untuk dikoreksi owner.
 * Link dua arah: booking.transaction_id ↔ transaction.meta.booking_id (idempoten).
 *
 * Hanya untuk bisnis sektor akomodasi. Transaksi settlement (pelunasan piutang)
 * & add-on tanpa nights diabaikan agar tidak double-count menginap.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BookingChannel } from '@/types';
import { isAccommodationSector } from '@/lib/businessSectors';

export interface ReconcileResult {
  linked: number;
  estimated: number;
  skipped: number;
  eligible: boolean; // false bila bisnis bukan sektor akomodasi
}

interface TxnRow {
  id: string;
  date: string;
  name: string | null;
  amount: number | string;
  sales_channel: string | null;
  meta: Record<string, unknown> | null;
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function resolveChannel(salesChannel: string | null, platform: unknown): BookingChannel {
  if (salesChannel === 'airbnb') return 'airbnb';
  if (salesChannel === 'booking_com') return 'booking_com';
  const p = typeof platform === 'string' ? platform.toLowerCase() : '';
  if (p.includes('airbnb')) return 'airbnb';
  if (p.includes('booking')) return 'booking_com';
  return salesChannel ? 'other' : 'manual';
}

export async function reconcileStayTransactions(
  admin: SupabaseClient,
  businessId: string
): Promise<ReconcileResult> {
  const result: ReconcileResult = { linked: 0, estimated: 0, skipped: 0, eligible: true };

  // Guard sektor — kalender booking hanya untuk akomodasi.
  const { data: biz } = await admin
    .from('businesses')
    .select('business_sector')
    .eq('id', businessId)
    .maybeSingle();
  if (!isAccommodationSector(biz?.business_sector as string | null)) {
    return { ...result, eligible: false };
  }

  // Unit default hanya bila persis satu unit kamar aktif (multi-unit → biarkan
  // null). Rate plan/add-on (is_bookable_unit=false, migr 115) tidak dihitung.
  const { data: units } = await admin
    .from('catalog_items')
    .select('id')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .eq('is_bookable_unit', true)
    .is('deleted_at', null);
  const defaultUnitId = units && units.length === 1 ? (units[0].id as string) : null;

  // transaction_id yang sudah punya booking (hindari duplikat).
  const { data: linkedRows } = await admin
    .from('bookings')
    .select('transaction_id')
    .eq('business_id', businessId)
    .not('transaction_id', 'is', null)
    .is('deleted_at', null);
  const alreadyLinked = new Set((linkedRows ?? []).map((r) => r.transaction_id as string));

  const { data: txns } = await admin
    .from('transactions')
    .select('id, date, name, amount, sales_channel, meta')
    .eq('business_id', businessId)
    .eq('category', 'EARN')
    .is('deleted_at', null);

  for (const t of (txns ?? []) as TxnRow[]) {
    const meta = (t.meta ?? {}) as Record<string, unknown>;

    // Skip: sudah ter-link, atau settlement (pelunasan, bukan stay baru).
    if (alreadyLinked.has(t.id) || meta.booking_id) {
      continue;
    }
    if (meta.settlement_of_transaction_id || meta.settlement_amount) {
      result.skipped += 1;
      continue;
    }

    const checkInMeta = typeof meta.check_in === 'string' ? (meta.check_in as string) : null;
    const checkOutMeta = typeof meta.check_out === 'string' ? (meta.check_out as string) : null;
    const nightsMeta = typeof meta.nights === 'number' ? (meta.nights as number) : null;

    // Butuh minimal nights atau rentang tanggal untuk bisa ditaruh di kalender.
    if (!checkInMeta && !nightsMeta) {
      result.skipped += 1;
      continue;
    }

    const checkIn = checkInMeta ?? t.date;
    let nights = nightsMeta ?? 0;
    if (!nights && checkInMeta && checkOutMeta) {
      nights = Math.max(
        0,
        Math.round(
          (Date.parse(checkOutMeta) - Date.parse(checkInMeta)) / (24 * 60 * 60 * 1000)
        )
      );
    }
    if (nights < 1) {
      result.skipped += 1;
      continue;
    }
    const checkOut = checkOutMeta ?? addDaysISO(checkIn, nights);
    const estimated = !checkInMeta;
    const amount = Number(t.amount) || 0;

    const { data: booking, error: insErr } = await admin
      .from('bookings')
      .insert({
        business_id: businessId,
        catalog_item_id: defaultUnitId,
        transaction_id: t.id,
        check_in: checkIn,
        check_out: checkOut,
        price_per_night: nights > 0 ? Math.round(amount / nights) : amount,
        total_amount: amount,
        guest_name: t.name || 'Tamu',
        status: 'confirmed',
        payment_status: 'paid',
        channel: resolveChannel(t.sales_channel, meta.platform),
        is_external: false,
        date_estimated: estimated,
        notes: estimated ? 'Tanggal perkiraan dari tanggal transaksi — mohon konfirmasi.' : null,
      })
      .select('id')
      .single();

    if (insErr || !booking) {
      result.skipped += 1;
      continue;
    }

    // Link balik ke transaksi (merge meta.booking_id).
    await admin
      .from('transactions')
      .update({ meta: { ...meta, booking_id: booking.id } })
      .eq('id', t.id);

    result.linked += 1;
    if (estimated) result.estimated += 1;
  }

  return result;
}
