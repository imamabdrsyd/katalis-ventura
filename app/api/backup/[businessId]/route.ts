import { NextRequest, NextResponse } from 'next/server';
import { canManageBusiness, getAuthenticatedUser, createServerClient } from '@/lib/supabase-server';
import { businessIdSchema } from '@/lib/validations';
import { BACKUP_EXCLUSIONS } from '@/lib/backup/manifest';
import { collectBackupData, type BackupQueryClient } from '@/lib/backup/collect';
import { BACKUP_SCHEMA_VERSION, type BackupEnvelope } from '@/lib/backup/types';

/**
 * GET /api/backup/[businessId]
 *
 * Mengembalikan seluruh data satu bisnis sebagai envelope JSON ber-versi.
 * Hanya manager/superadmin bisnis tersebut yang boleh menariknya — investor
 * bersifat read-only di UI, tapi dump penuh tetap bukan haknya.
 *
 * Logika pengambilan datanya ada di `src/lib/backup/collect.ts` supaya paginasi
 * dan chunking bisa diuji tanpa database.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { businessId } = await params;
    const parsed = businessIdSchema.safeParse(businessId);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid business ID format' }, { status: 400 });
    }

    // RLS tetap menyala sebagai jaring pengaman lapis kedua — bukan admin client.
    const supabase = await createServerClient();

    if (!(await canManageBusiness(supabase, user.id, parsed.data))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Satu-satunya cast di jalur ini: client Supabase memenuhi BackupQueryClient
    // secara struktural, tapi generic PostgREST-nya tidak bisa disimpulkan TS
    // untuk nama tabel yang baru diketahui saat runtime.
    const { data, counts } = await collectBackupData(
      supabase as unknown as BackupQueryClient,
      parsed.data
    );

    const business = (data.businesses?.[0] ?? null) as { business_name?: string } | null;
    if (!business) {
      return NextResponse.json({ error: 'Bisnis tidak ditemukan' }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();

    const envelope: BackupEnvelope = {
      schema_version: BACKUP_SCHEMA_VERSION,
      exported_at: new Date().toISOString(),
      exported_by: { id: user.id, name: profile?.full_name ?? null },
      business: { id: parsed.data, business_name: business.business_name ?? '' },
      counts,
      excluded: BACKUP_EXCLUSIONS,
      data,
    };

    return NextResponse.json(envelope, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Backup GET error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
