import { NextRequest, NextResponse } from 'next/server';
import { canManageBusiness, getAuthenticatedUser, createServerClient } from '@/lib/supabase-server';
import { businessIdSchema, createChannelIntegrationSchema } from '@/lib/validations';
import { toClientIntegration } from '@/lib/integrations/config';
import type { ChannelIntegration } from '@/types';

/**
 * GET /api/integrations?businessId=<uuid>
 * List integrasi channel sebuah bisnis untuk UI (status koneksi + setelan AI).
 * RLS membatasi SELECT ke bisnis yang user jadi member-nya. Token di config
 * di-strip sebelum dikirim ke client.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const businessId = request.nextUrl.searchParams.get('businessId');
  const parsed = businessIdSchema.safeParse(businessId);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid business ID' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('channel_integrations')
    .select('*')
    .eq('business_id', parsed.data)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const safe = ((data as ChannelIntegration[]) ?? []).map(toClientIntegration);
  return NextResponse.json({ data: safe });
}

/**
 * POST /api/integrations — aktifkan channel tanpa kredensial token
 * (Airbnb, Booking.com — pesan masuk lewat webhook generic Zapier/Make,
 * tidak ada OAuth/token untuk disimpan). Instagram & WhatsApp punya route
 * khusus sendiri (butuh OAuth / verifikasi kredensial).
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createChannelIntegrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const input = parsed.data;

  if (input.channel === 'instagram' || input.channel === 'whatsapp') {
    return NextResponse.json(
      { error: `Channel ${input.channel} dihubungkan lewat tombol Connect, bukan endpoint ini` },
      { status: 422 }
    );
  }

  const supabase = await createServerClient();
  if (!(await canManageBusiness(supabase, user.id, input.business_id))) {
    return NextResponse.json(
      { error: 'Hanya manager yang bisa mengaktifkan integrasi' },
      { status: 403 }
    );
  }

  // Manual upsert by (business_id, channel) — partial unique index tidak
  // bisa dipakai ON CONFLICT lewat PostgREST.
  const { data: existing } = await supabase
    .from('channel_integrations')
    .select('id')
    .eq('business_id', input.business_id)
    .eq('channel', input.channel)
    .is('deleted_at', null)
    .maybeSingle();

  let saved: ChannelIntegration;
  if (existing) {
    const { data, error } = await supabase
      .from('channel_integrations')
      .update({ is_active: true })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    saved = data as ChannelIntegration;
  } else {
    const { data, error } = await supabase
      .from('channel_integrations')
      .insert({
        business_id: input.business_id,
        channel: input.channel,
        is_active: true,
        ai_enabled: input.ai_enabled,
        ai_mode: input.ai_mode,
        ai_persona: input.ai_persona ?? null,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    saved = data as ChannelIntegration;
  }

  return NextResponse.json({ data: toClientIntegration(saved) });
}
