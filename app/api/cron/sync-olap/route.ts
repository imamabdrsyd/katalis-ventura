/**
 * /api/cron/sync-olap — Cron job (Vercel) untuk sinkronisasi OLAP otomatis.
 *
 * Menyalin data Supabase (OLTP) → GCP Cloud SQL (OLAP) untuk SEMUA bisnis aktif,
 * supaya tool agent run_olap_analytics selalu membaca data yang relatif fresh tanpa
 * user harus klik Sinkronisasi manual di Settings.
 *
 * Keamanan: hanya boleh dipanggil Vercel Cron. Vercel otomatis menyertakan header
 * `Authorization: Bearer ${CRON_SECRET}` bila env CRON_SECRET di-set. Request tanpa
 * secret yang cocok ditolak 401.
 *
 * Tiap bisnis disync sequential dengan isolasi error: kegagalan satu bisnis tidak
 * menghentikan yang lain.
 *
 * ⚠️ NONAKTIF sejak 10 Agustus 2026 — jadwalnya sudah dihapus dari vercel.json karena
 * instance Cloud SQL `axion-agents` dihapus untuk menolkan tagihan, jadi cron ini hanya
 * akan gagal tiap hari. Route sengaja DIPERTAHANKAN supaya tinggal pasang lagi entry
 * crons di vercel.json kalau instance OLAP dibangun ulang (jangan lupa update env
 * GCP_ANALYTICS_DB_URL + jalankan /api/admin/gcp/init-schema lebih dulu).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';
import { syncBusinessDataToGCP } from '@/lib/gcpSync';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  // Tolak kalau secret belum dikonfigurasi (fail closed) atau tidak cocok.
  if (!cronSecret) {
    console.error('[cron/sync-olap] CRON_SECRET belum di-set — menolak request.');
    return NextResponse.json({ error: 'Cron belum dikonfigurasi.' }, { status: 503 });
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const admin = createAdminClient();

  const { data: businesses, error } = await admin
    .from('businesses')
    .select('id')
    .or('is_archived.is.null,is_archived.eq.false');

  if (error) {
    console.error('[cron/sync-olap] Gagal ambil daftar bisnis:', error.message);
    return NextResponse.json({ error: 'Gagal mengambil daftar bisnis.' }, { status: 500 });
  }

  const ids = (businesses ?? []).map((b) => b.id as string);
  const results: Array<{ business_id: string; ok: boolean; transactions?: number; error?: string }> = [];

  // Sequential + isolasi error agar satu bisnis gagal tidak membatalkan lainnya.
  for (const id of ids) {
    try {
      const res = await syncBusinessDataToGCP(id);
      results.push({ business_id: id, ok: true, transactions: res.transactions });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[cron/sync-olap] Sync gagal untuk ${id}:`, msg);
      results.push({ business_id: id, ok: false, error: msg });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.length - succeeded;
  const durationMs = Date.now() - startedAt;

  console.log(`[cron/sync-olap] Selesai: ${succeeded} sukses, ${failed} gagal dalam ${durationMs}ms.`);

  return NextResponse.json({
    message: 'Sinkronisasi OLAP selesai',
    total: ids.length,
    succeeded,
    failed,
    duration_ms: durationMs,
    results,
  });
}
