/**
 * POST /api/calendar/backfill  { businessId }
 *
 * Rekonsiliasi transaksi revenue menginap (EARN) yang sudah ada di ledger →
 * bookings terhubung, supaya muncul di kalender. Manager-only + sektor akomodasi.
 * Idempoten — aman dijalankan berulang (tombol "Tarik ke kalender").
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  canManageBusiness,
  createServerClient,
  createAdminClient,
  getAuthenticatedUser,
} from '@/lib/supabase-server';
import { badRequest, forbidden, serverError, unauthorized } from '@/lib/api/server/responses';
import { reconcileStayTransactions } from '@/lib/api/bookingBackfill';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const body = (await req.json().catch(() => null)) as { businessId?: string } | null;
    const businessId = body?.businessId;
    if (!businessId) return badRequest('businessId wajib diisi');

    const supabase = await createServerClient();
    if (!(await canManageBusiness(supabase, user.id, businessId))) {
      return forbidden('Hanya manager bisnis yang dapat menarik revenue ke kalender');
    }

    const admin = createAdminClient();
    const result = await reconcileStayTransactions(admin, businessId);
    return NextResponse.json(result);
  } catch (err) {
    return serverError(err instanceof Error ? err : new Error('Backfill gagal'));
  }
}
