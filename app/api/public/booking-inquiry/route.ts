/**
 * POST /api/public/booking-inquiry  { slug, check_in, check_out, guest_name?, note? }
 *
 * PUBLIK (tanpa auth) — dipanggil widget omnichannel di halaman /[slug] saat
 * calon tamu klik CTA "cek ketersediaan". Membuat booking berstatus **TENTATIF**
 * (channel 'website') di unit sumber harga bisnis, dengan tanggal dari widget.
 * Follow-up terjadi di WhatsApp (di luar sistem); owner melihatnya di kalender &
 * meng-update status manual. Best-effort: kegagalan TIDAK memblokir alur WA di
 * client — booking cuma catatan lead untuk owner.
 *
 * Anti-spam ringan: tolak rentang tak valid / terlalu panjang, dan lewati bila
 * sudah ada tentatif website identik (unit+tanggal+nama) yang belum lewat.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';
import { isAccommodationSector } from '@/lib/businessSectors';
import { buildUnitBaseRates, quoteStayV2, type RateOverride } from '@/lib/rates';
import type { CatalogItem } from '@/types';

export const dynamic = 'force-dynamic';

const MAX_NIGHTS = 90;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    slug?: string;
    check_in?: string;
    check_out?: string;
    guest_name?: string;
    note?: string;
  } | null;

  const slug = body?.slug?.trim();
  const checkIn = body?.check_in?.trim();
  const checkOut = body?.check_out?.trim();
  if (!slug || !checkIn || !checkOut) {
    return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
  }
  // Validasi tanggal dasar (YYYY-MM-DD, checkout > checkin, rentang wajar).
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(checkIn) || !dateRe.test(checkOut) || checkOut <= checkIn) {
    return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 });
  }
  const nights = Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000);
  if (nights < 1 || nights > MAX_NIGHTS) {
    return NextResponse.json({ error: 'Rentang tanggal tidak valid' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Resolve bisnis dari slug omnichannel yang published.
  const { data: oc } = await admin
    .from('business_omni_channels')
    .select('business_id')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();
  if (!oc) return NextResponse.json({ error: 'Bisnis tidak ditemukan' }, { status: 404 });

  const businessId = oc.business_id as string;

  const { data: biz } = await admin
    .from('businesses')
    .select('business_sector')
    .eq('id', businessId)
    .maybeSingle();
  if (!isAccommodationSector(biz?.business_sector as string | null)) {
    // Bukan akomodasi → tak ada konsep booking; abaikan diam-diam (sukses no-op).
    return NextResponse.json({ ok: true, created: false });
  }

  // Unit tempat inquiry masuk = unit aktif pertama (harga publiknya ditampilkan).
  const { data: units } = await admin
    .from('business_units')
    .select('id')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });
  const unit = (units ?? [])[0];
  if (!unit) return NextResponse.json({ ok: true, created: false });

  const guestName = (body?.guest_name?.trim() || 'Calon tamu (web)').slice(0, 120);
  const note = body?.note?.trim()?.slice(0, 500) || null;

  // Idempoten ringan: sudah ada tentatif website identik yang belum lewat?
  const { data: dup } = await admin
    .from('bookings')
    .select('id')
    .eq('business_id', businessId)
    .eq('unit_id', unit.id)
    .eq('channel', 'website')
    .eq('status', 'tentative')
    .eq('check_in', checkIn)
    .eq('check_out', checkOut)
    .eq('guest_name', guestName)
    .is('deleted_at', null)
    .maybeSingle();
  if (dup) return NextResponse.json({ ok: true, created: false, duplicate: true });

  // Harga = quote model baru (migr 124): base weekday/weekend by hari + override
  // per tanggal; rentang > 27 malam pakai rate bulanan bila ada.
  const { data: itemRows } = await admin
    .from('catalog_items')
    .select('id, default_price, is_active, service_role, rate_kind')
    .eq('business_id', businessId)
    .eq('unit_id', unit.id)
    .eq('is_active', true)
    .is('deleted_at', null);
  const base = buildUnitBaseRates((itemRows ?? []) as unknown as CatalogItem[]);

  const { data: rateRows } = await admin
    .from('unit_daily_rates')
    .select('date, price')
    .eq('unit_id', unit.id)
    .gte('date', checkIn)
    .lt('date', checkOut);
  const overrides: RateOverride[] = ((rateRows ?? []) as Array<{ date: string; price: number | string }>).map((r) => ({
    date: r.date,
    price: typeof r.price === 'string' ? parseFloat(r.price) : r.price,
  }));

  const quote = quoteStayV2(checkIn, checkOut, base, overrides);
  const totalAmount = quote.total;
  const pricePerNight = nights > 0 ? Math.round(totalAmount / nights) : 0;

  const { error: insErr } = await admin.from('bookings').insert({
    business_id: businessId,
    unit_id: unit.id,
    check_in: checkIn,
    check_out: checkOut,
    price_per_night: pricePerNight,
    total_amount: totalAmount,
    guest_name: guestName,
    status: 'tentative',
    payment_status: 'unpaid',
    channel: 'website',
    is_external: false,
    date_estimated: false,
    notes: note ? `Inquiry web: ${note}` : 'Inquiry dari halaman publik (belum dikonfirmasi).',
  });

  if (insErr) {
    // Bentrok tanggal (SQLSTATE 23P01) tetap dilaporkan sukses ke client (alur WA
    // tetap jalan) — tapi tandai created:false agar tak menyesatkan.
    console.error('[booking-inquiry] insert gagal:', insErr.message);
    return NextResponse.json({ ok: true, created: false, conflict: insErr.code === '23P01' });
  }

  return NextResponse.json({ ok: true, created: true });
}
