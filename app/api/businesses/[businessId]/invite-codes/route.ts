import { NextRequest, NextResponse } from 'next/server';
import { canManageBusiness, createServerClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { businessIdSchema } from '@/lib/validations';
import { z } from 'zod';
import { badRequest, forbidden, serverError, unauthorized, validationError } from '@/lib/api/server/responses';

interface RouteParams {
  params: Promise<{ businessId: string }>;
}

const createInviteCodeSchema = z.object({
  role: z.enum(['business_manager', 'investor', 'both', 'superadmin']),
  expires_at: z.string().optional().nullable(),
  max_uses: z.number().int().positive().optional(),
});

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(array[i] % chars.length);
  }
  return code;
}

/**
 * GET /api/businesses/[businessId]/invite-codes
 * List invite codes for a business (manager-only).
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const { businessId } = await params;
    const idParsed = businessIdSchema.safeParse(businessId);
    if (!idParsed.success) return badRequest('Format ID bisnis tidak valid');

    const supabase = await createServerClient();
    if (!(await canManageBusiness(supabase, user.id, idParsed.data))) {
      return forbidden('Hanya manager bisnis yang dapat melihat kode undangan');
    }

    const { data, error } = await supabase
      .from('invite_codes')
      .select('*')
      .eq('business_id', idParsed.data)
      .order('created_at', { ascending: false });

    if (error) return serverError(error);
    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * POST /api/businesses/[businessId]/invite-codes
 * Create a new invite code (manager-only).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const { businessId } = await params;
    const idParsed = businessIdSchema.safeParse(businessId);
    if (!idParsed.success) return badRequest('Format ID bisnis tidak valid');

    const body = await request.json();
    const parsed = createInviteCodeSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const supabase = await createServerClient();
    if (!(await canManageBusiness(supabase, user.id, idParsed.data))) {
      return forbidden('Hanya manager bisnis yang dapat membuat kode undangan');
    }

    const { data, error } = await supabase
      .from('invite_codes')
      .insert({
        business_id: idParsed.data,
        code: generateCode(),
        role: parsed.data.role,
        created_by: user.id,
        expires_at: parsed.data.expires_at ?? null,
        max_uses: parsed.data.max_uses ?? 10,
        current_uses: 0,
        is_active: true,
      })
      .select()
      .single();

    if (error) return serverError(error);
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
