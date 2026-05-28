import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { serverError, unauthorized, validationError } from '@/lib/api/server/responses';

const bodySchema = z.object({
  code: z.string().min(1).max(20),
});

/**
 * POST /api/invite-codes/use
 * Body: { code: string }
 * Use an invite code to join a business. All validation (expiry, max_uses,
 * duplicate membership) happens inside the use_invite_code RPC.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const supabase = await createServerClient();
    // CRIT-03: RPC sekarang single-arg. user_id selalu auth.uid() di dalam
    // function (SECURITY DEFINER) — tidak bisa di-spoof dari klien.
    void user;
    const { data, error } = await supabase.rpc('use_invite_code', {
      p_code: parsed.data.code.toUpperCase(),
    });

    if (error) {
      console.error('use_invite_code RPC error:', error);
      return NextResponse.json(
        { error: 'Gagal memproses kode undangan. Coba lagi.' },
        { status: 500 }
      );
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return NextResponse.json({ data: { success: false, message: 'Kode undangan tidak valid' } });
    }

    return NextResponse.json({
      data: {
        success: row.success,
        message: row.message ?? undefined,
        businessId: row.business_id ?? undefined,
      },
    });
  } catch (err) {
    return serverError(err);
  }
}
