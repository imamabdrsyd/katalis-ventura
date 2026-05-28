import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { canManageBusiness, createServerClient, createAdminClient, getAuthenticatedUser } from '@/lib/supabase-server';

// CRIT-02 fix: role yang diberikan saat approve ditentukan oleh approver,
// BUKAN dibaca dari profiles.default_role requester. Sebelumnya, requester
// yang sempat self-promote ke profiles.default_role='superadmin' otomatis
// jadi superadmin di bisnis saat owner approve.
//
// 'superadmin' sengaja tidak diizinkan lewat jalur ini — promosi superadmin
// harus eksplisit lewat member management, bukan side-effect approve.
const approveBodySchema = z
  .object({ role: z.enum(['investor', 'business_manager']).optional() })
  .partial()
  .default({});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    // Body opsional — UI lama yang POST tanpa body tetap kompatibel
    // (default = investor).
    let parsedBody: z.infer<typeof approveBodySchema> = {};
    try {
      const raw = await request.json();
      const parsed = approveBodySchema.safeParse(raw ?? {});
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Role tidak valid (gunakan investor atau business_manager)' },
          { status: 400 }
        );
      }
      parsedBody = parsed.data;
    } catch {
      parsedBody = {};
    }

    const assignedRole: 'investor' | 'business_manager' = parsedBody.role ?? 'investor';

    const supabase = await createServerClient();
    const admin = createAdminClient();

    const { data: req, error: fetchErr } = await admin
      .from('business_join_requests')
      .select('id, business_id, requester_id, status')
      .eq('id', requestId)
      .single();

    if (fetchErr || !req) {
      return NextResponse.json({ error: 'Permintaan tidak ditemukan' }, { status: 404 });
    }

    if (!(await canManageBusiness(supabase, user.id, req.business_id))) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses untuk mengelola bisnis ini' }, { status: 403 });
    }

    if (req.status !== 'pending') {
      return NextResponse.json({ error: 'Permintaan sudah diproses sebelumnya' }, { status: 409 });
    }

    const { error: updateErr } = await admin
      .from('business_join_requests')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateErr) throw updateErr;

    const { error: roleErr } = await admin
      .from('user_business_roles')
      .upsert(
        {
          user_id: req.requester_id,
          business_id: req.business_id,
          role: assignedRole,
          invited_by: user.id,
        },
        { onConflict: 'user_id,business_id' }
      );

    if (roleErr) throw roleErr;

    return NextResponse.json({ success: true, role: assignedRole });
  } catch (error) {
    console.error('Error approving request:', error);
    const message = error instanceof Error ? error.message : 'Gagal menyetujui permintaan';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
