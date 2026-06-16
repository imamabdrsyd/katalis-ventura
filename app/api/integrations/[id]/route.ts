import { NextRequest, NextResponse } from 'next/server';
import { canManageBusiness, getAuthenticatedUser, createServerClient } from '@/lib/supabase-server';
import { updateChannelIntegrationSchema } from '@/lib/validations';
import { toClientIntegration } from '@/lib/integrations/config';
import type { ChannelIntegration } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Ambil integrasi + verifikasi user manager bisnisnya. */
async function loadManageableIntegration(id: string) {
  const user = await getAuthenticatedUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const supabase = await createServerClient();
  const { data: integration, error } = await supabase
    .from('channel_integrations')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return { error: NextResponse.json({ error: error.message }, { status: 500 }) };
  if (!integration) {
    return { error: NextResponse.json({ error: 'Integrasi tidak ditemukan' }, { status: 404 }) };
  }
  if (!(await canManageBusiness(supabase, user.id, integration.business_id))) {
    return { error: NextResponse.json({ error: 'Hanya manager yang bisa mengubah' }, { status: 403 }) };
  }

  return { supabase, integration: integration as ChannelIntegration };
}

/**
 * PATCH /api/integrations/[id] — ubah setelan AI (ai_enabled/ai_mode/ai_persona).
 * Hanya field AI yang boleh diubah lewat sini; token/koneksi diatur lewat OAuth.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const loaded = await loadManageableIntegration(id);
  if (loaded.error) return loaded.error;
  const { supabase, integration } = loaded;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updateChannelIntegrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Whitelist: hanya setelan AI (jangan biarkan client menimpa config/token).
  const patch: Record<string, unknown> = {};
  if (parsed.data.ai_enabled !== undefined) patch.ai_enabled = parsed.data.ai_enabled;
  if (parsed.data.ai_mode !== undefined) patch.ai_mode = parsed.data.ai_mode;
  if (parsed.data.ai_persona !== undefined) patch.ai_persona = parsed.data.ai_persona;
  // Tier Concierge: merge ke config JSONB existing (jangan timpa token/field config lain).
  if (parsed.data.ai_tier !== undefined) {
    const currentConfig = (integration.config as Record<string, unknown> | null) ?? {};
    patch.config = { ...currentConfig, ai_tier: parsed.data.ai_tier };
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Tidak ada field untuk diubah' }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from('channel_integrations')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: toClientIntegration(updated as ChannelIntegration) });
}

/**
 * DELETE /api/integrations/[id] — putuskan koneksi (set is_active=false).
 * Riwayat lead/percakapan tidak dihapus.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const loaded = await loadManageableIntegration(id);
  if (loaded.error) return loaded.error;
  const { supabase } = loaded;

  const { error } = await supabase
    .from('channel_integrations')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
