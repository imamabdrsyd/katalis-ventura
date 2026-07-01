/**
 * POST /api/calendar/ical/sync  { businessId }
 *
 * Trigger manual sinkronisasi impor iCal OTA untuk satu bisnis (tombol "Sync
 * sekarang" di UI kalender). Manager-only. Memakai admin client untuk menulis
 * blok eksternal (bypass RLS) setelah verifikasi role.
 */

import { NextRequest } from 'next/server';
import {
  canManageBusiness,
  createServerClient,
  createAdminClient,
  getAuthenticatedUser,
} from '@/lib/supabase-server';
import { badRequest, forbidden, serverError, unauthorized } from '@/lib/api/server/responses';
import { syncBusinessIcalFeeds } from '@/lib/api/icalSync';
import { NextResponse } from 'next/server';

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
      return forbidden('Hanya manager bisnis yang dapat menyinkronkan kalender');
    }

    const admin = createAdminClient();
    const result = await syncBusinessIcalFeeds(admin, businessId);
    return NextResponse.json(result);
  } catch (err) {
    return serverError(err instanceof Error ? err : new Error('Sync gagal'));
  }
}
