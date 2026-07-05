/**
 * GET /api/calendar/feed/[token]?unit=<unitId>
 *
 * Feed .ics PUBLIK (bertoken) berisi booking langsung bisnis — dipasang user di
 * Airbnb/Booking.com ("Import calendar") agar OTA memblokir tanggal yang sudah
 * dibooking langsung. Token = `businesses.ical_feed_token`. Blok impor OTA
 * (`is_external`) TIDAK diekspor (cegah loop). Filter `unit` = per unit fisik (listing).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';
import { generateIcs, type IcalEvent } from '@/lib/ical';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  if (!token || token.length < 20) {
    return new NextResponse('Not found', { status: 404 });
  }

  const admin = createAdminClient();
  const { data: business } = await admin
    .from('businesses')
    .select('id, business_name')
    .eq('ical_feed_token', token)
    .maybeSingle();

  if (!business) return new NextResponse('Not found', { status: 404 });

  const unitId = req.nextUrl.searchParams.get('unit');
  let query = admin
    .from('bookings')
    .select('id, check_in, check_out, guest_name')
    .eq('business_id', business.id)
    .is('deleted_at', null)
    .eq('is_external', false)
    .neq('status', 'cancelled')
    .not('check_in', 'is', null); // booking di penampungan (tanpa tanggal) tak diekspor

  if (unitId) query = query.eq('unit_id', unitId);

  const { data: bookings } = await query;

  const events: IcalEvent[] = (bookings ?? []).map((b) => ({
    uid: `booking-${b.id}@axion`,
    start: b.check_in as string,
    end: b.check_out as string,
    summary: 'Booked (AXION)',
  }));

  const ics = generateIcs({ calName: `${business.business_name} — AXION`, events });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="axion-calendar.ics"',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
