import { NextRequest, NextResponse } from 'next/server';
import { canManageBusiness, getAuthenticatedUser, createServerClient } from '@/lib/supabase-server';
import { connectWhatsAppSchema } from '@/lib/validations';
import { verifyWhatsAppCredentials } from '@/lib/whatsapp';
import { buildTokenConfig, toClientIntegration } from '@/lib/integrations/config';
import type { ChannelIntegration } from '@/types';

/**
 * POST /api/integrations/whatsapp — simpan kredensial WhatsApp per-bisnis.
 *
 * Manager isi Phone Number ID + Access Token (dari Meta dashboard bisnis
 * masing-masing). Kredensial diverifikasi live ke Graph API dulu, lalu token
 * disimpan TERENKRIPSI di channel_integrations.config. Dipakai juga untuk
 * memperbarui token yang expired (upsert ke row yang sama).
 */
export async function POST(request: NextRequest) {
  try {
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

    const parsed = connectWhatsAppSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { business_id, phone_number_id, access_token } = parsed.data;

    const supabase = await createServerClient();
    if (!(await canManageBusiness(supabase, user.id, business_id))) {
      return NextResponse.json(
        { error: 'Hanya manager yang bisa menghubungkan WhatsApp' },
        { status: 403 }
      );
    }

    // Verifikasi kredensial live ke Graph API — tolak token/nomor salah di awal
    const info = await verifyWhatsAppCredentials({
      phoneNumberId: phone_number_id,
      accessToken: access_token,
    });
    if (!info) {
      return NextResponse.json(
        { error: 'Kredensial tidak valid — cek Phone Number ID & Access Token di Meta dashboard.' },
        { status: 422 }
      );
    }

    const config = buildTokenConfig({
      accessToken: access_token,
      extra: {
        display_phone_number: info.displayPhoneNumber,
        verified_name: info.verifiedName,
      },
    });

    // Manual upsert by (business_id, 'whatsapp') — partial unique index tidak
    // bisa dipakai ON CONFLICT lewat PostgREST. Reconnect/perbarui token = update.
    const { data: existing } = await supabase
      .from('channel_integrations')
      .select('id')
      .eq('business_id', business_id)
      .eq('channel', 'whatsapp')
      .is('deleted_at', null)
      .maybeSingle();

    let saved: ChannelIntegration;
    if (existing) {
      const { data, error } = await supabase
        .from('channel_integrations')
        .update({ is_active: true, external_account_id: phone_number_id, config })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) {
        console.error('[integrations/whatsapp] update error:', error.message);
        return NextResponse.json({ error: 'Gagal menyimpan koneksi' }, { status: 500 });
      }
      saved = data as ChannelIntegration;
    } else {
      const { data, error } = await supabase
        .from('channel_integrations')
        .insert({
          business_id,
          channel: 'whatsapp',
          is_active: true,
          external_account_id: phone_number_id,
          config,
          ai_enabled: false,
          ai_mode: 'auto',
          created_by: user.id,
        })
        .select()
        .single();
      if (error) {
        console.error('[integrations/whatsapp] insert error:', error.message);
        return NextResponse.json({ error: 'Gagal menyimpan koneksi' }, { status: 500 });
      }
      saved = data as ChannelIntegration;
    }

    return NextResponse.json({ data: toClientIntegration(saved) });
  } catch (err) {
    console.error('[integrations/whatsapp] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
