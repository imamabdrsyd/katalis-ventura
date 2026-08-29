import { NextRequest, NextResponse } from 'next/server';
import { canManageBusiness, getAuthenticatedUser, createServerClient } from '@/lib/supabase-server';
import { findActiveIntegration } from '@/lib/leads';
import { getInstagramSenderName } from '@/lib/instagram/api';
import { getFreshToken } from '@/lib/instagram/token';

/**
 * POST /api/leads/backfill-names  { businessId }
 *
 * Resolve ulang nama lead Instagram yang masih fallback numerik "@<IGSID>".
 * Terjadi pada lead yang masuk selama token bisnis kedaluwarsa: webhook tetap
 * menyimpan pesannya, tapi lookup username gagal. Self-heal di upsertLead cuma
 * jalan kalau customer mengirim DM lagi — route ini menambalnya sekaligus.
 *
 * Idempoten: lead yang sudah punya nama asli tidak disentuh.
 */

/** Batas per panggilan — jaga-jaga terhadap timeout 60s Vercel & rate limit Graph API. */
const MAX_PER_RUN = 100;

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { businessId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const businessId = body.businessId;
  if (!businessId) {
    return NextResponse.json({ error: 'businessId wajib diisi' }, { status: 400 });
  }

  const supabase = await createServerClient();
  if (!(await canManageBusiness(supabase, user.id, businessId))) {
    return NextResponse.json({ error: 'Hanya manager yang bisa menjalankan ini' }, { status: 403 });
  }

  const integration = await findActiveIntegration(supabase, {
    businessId,
    channel: 'instagram',
  });
  if (!integration) {
    return NextResponse.json({ error: 'Instagram belum terhubung' }, { status: 400 });
  }

  const token = await getFreshToken(supabase, integration);
  if (!token) {
    return NextResponse.json({ error: 'Token Instagram tidak tersedia' }, { status: 400 });
  }

  // Nama fallback numerik: "@123..." atau "123...". PostgREST tidak punya regex,
  // jadi ambil kandidat lalu saring di sini.
  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, name, external_id')
    .eq('business_id', businessId)
    .eq('channel', 'instagram')
    .is('deleted_at', null)
    .order('last_message_at', { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const candidates = (leads ?? [])
    .filter((l) => !l.name || /^@?\d+$/.test(String(l.name).trim()))
    .slice(0, MAX_PER_RUN);

  let resolved = 0;
  let failed = 0;

  for (const lead of candidates) {
    const name = await getInstagramSenderName(token, lead.external_id);
    // Graph API tidak mengenali user ini (percakapan terlalu lama / akun hilang)
    // → biarkan fallback numeriknya, jangan tulis nama kosong.
    if (!name || /^@?\d+$/.test(name.trim())) {
      failed++;
      continue;
    }

    const { error: updateError } = await supabase
      .from('leads')
      .update({ name })
      .eq('id', lead.id);

    if (updateError) {
      console.warn('[leads/backfill-names] gagal update lead:', lead.id, updateError.message);
      failed++;
      continue;
    }
    resolved++;
  }

  return NextResponse.json({
    data: {
      candidates: candidates.length,
      resolved,
      failed,
      /** true kalau masih ada sisa — jalankan lagi untuk batch berikutnya. */
      hasMore: candidates.length === MAX_PER_RUN,
    },
  });
}
