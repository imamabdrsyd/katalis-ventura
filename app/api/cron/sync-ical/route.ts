/**
 * /api/cron/sync-ical — Cron (Vercel) impor kalender OTA (Airbnb/Booking.com).
 *
 * Untuk setiap bisnis yang punya unit dengan `ical_import_url`, tarik feed .ics
 * dan sinkronkan blok ketersediaan (`bookings.is_external=true`). Keamanan sama
 * dengan sync-olap: hanya Vercel Cron via header `Authorization: Bearer CRON_SECRET`.
 * Jadwal di vercel.json.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';
import { syncBusinessIcalFeeds } from '@/lib/api/icalSync';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[cron/sync-ical] CRON_SECRET belum di-set — menolak request.');
    return NextResponse.json({ error: 'Cron belum dikonfigurasi.' }, { status: 503 });
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const admin = createAdminClient();

  // Bisnis yang punya minimal satu unit dengan feed impor.
  const { data: rows, error } = await admin
    .from('catalog_items')
    .select('business_id')
    .not('ical_import_url', 'is', null)
    .is('deleted_at', null);

  if (error) {
    console.error('[cron/sync-ical] Gagal ambil unit ber-feed:', error.message);
    return NextResponse.json({ error: 'Gagal mengambil daftar feed.' }, { status: 500 });
  }

  const businessIds = Array.from(new Set((rows ?? []).map((r) => r.business_id as string)));
  const results: Array<{ business_id: string; ok: boolean; imported?: number; removed?: number; error?: string }> = [];

  for (const id of businessIds) {
    try {
      const r = await syncBusinessIcalFeeds(admin, id);
      results.push({ business_id: id, ok: true, imported: r.imported + r.updated, removed: r.removed });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[cron/sync-ical] Sync gagal untuk ${id}:`, msg);
      results.push({ business_id: id, ok: false, error: msg });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  return NextResponse.json({
    message: 'Sinkronisasi iCal selesai',
    total: businessIds.length,
    succeeded,
    failed: results.length - succeeded,
    duration_ms: Date.now() - startedAt,
    results,
  });
}
