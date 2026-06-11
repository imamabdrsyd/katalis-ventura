import { NextRequest, NextResponse } from 'next/server';
import { canManageBusiness, getAuthenticatedUser, createServerClient } from '@/lib/supabase-server';
import { sendLeadReplySchema } from '@/lib/validations';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { withRouteTiming } from '@/lib/api/server/timing';

/**
 * POST /api/leads/reply — kirim balasan manual WhatsApp dari inbox Leads.
 *
 * Harus lewat server route (bukan client-side) karena Graph API butuh
 * WHATSAPP_ACCESS_TOKEN. Hanya channel 'whatsapp' — channel OTA tidak punya
 * jalur kirim, balasannya manual lewat platform masing-masing (approve draft).
 */
async function handleReplyPost(request: NextRequest) {
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

    const parsed = sendLeadReplySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { lead_id, message } = parsed.data;

    // RLS membatasi SELECT ke bisnis milik user — lead bisnis lain = not found
    const supabase = await createServerClient();
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, business_id, channel, external_id, status')
      .eq('id', lead_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (leadError) {
      return NextResponse.json({ error: leadError.message }, { status: 500 });
    }
    if (!lead) {
      return NextResponse.json({ error: 'Lead tidak ditemukan' }, { status: 404 });
    }

    if (!(await canManageBusiness(supabase, user.id, lead.business_id))) {
      return NextResponse.json({ error: 'Hanya manager yang bisa membalas' }, { status: 403 });
    }

    if (lead.channel !== 'whatsapp') {
      return NextResponse.json(
        { error: 'Balasan langsung hanya untuk channel WhatsApp. Channel lain: approve draft lalu kirim manual di platformnya.' },
        { status: 422 }
      );
    }

    const sent = await sendWhatsAppMessage(lead.external_id, message);
    if (!sent.ok) {
      return NextResponse.json(
        { error: `Gagal kirim ke WhatsApp: ${sent.error ?? 'unknown'}. Cek 24-hour window / kredensial.` },
        { status: 502 }
      );
    }

    // Simpan outbound + sentuh last_message_at; status new → contacted.
    // Insert via server client — RLS manager insert policy yang berlaku.
    const { data: saved, error: insertError } = await supabase
      .from('lead_messages')
      .insert({
        lead_id: lead.id,
        business_id: lead.business_id,
        direction: 'outbound',
        sender: 'human',
        content: message,
        external_message_id: sent.messageId ?? null,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      // Pesan sudah terkirim ke customer — laporkan tapi jangan klaim gagal total
      console.error('[leads/reply] terkirim tapi gagal simpan:', insertError.message);
      return NextResponse.json(
        { error: 'Pesan terkirim tapi gagal disimpan ke riwayat. Refresh halaman.' },
        { status: 500 }
      );
    }

    await supabase
      .from('leads')
      .update({
        last_message_at: new Date().toISOString(),
        ...(lead.status === 'new' ? { status: 'contacted' } : {}),
      })
      .eq('id', lead.id);

    return NextResponse.json({ ok: true, data: saved });
  } catch (error) {
    console.error('[leads/reply] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return withRouteTiming(request, '/api/leads/reply', () => handleReplyPost(request));
}
