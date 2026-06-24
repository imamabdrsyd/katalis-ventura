import { NextResponse, after } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getAuthenticatedUser } from '@/lib/supabase-server';

import { saveManualMemory } from '@/lib/ai/memory';
import { ingestVaultMemory } from '@/lib/ai/semanticMemory';

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { businessId, messages } = body;

    if (!businessId || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data: roleData } = await supabase
      .from('user_business_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('business_id', businessId)
      .single();
    if (!roleData) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Rangkum pesan menjadi sebuah string teks untuk disimpan
    // Pada fase 1, kita format menjadi teks transcript. Di fase 2 bisa di-summarize oleh LLM.
    const transcript = messages
      .filter((m: any) => m.role && m.text)
      .map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
      .join('\n\n');

    if (!transcript) {
      return NextResponse.json({ error: 'No valid text messages to memorize' }, { status: 400 });
    }

    await saveManualMemory(businessId, user.id, transcript, {
      source: 'aichatpanel',
      message_count: messages.length
    });

    // Embed + simpan ke GCP untuk recall semantik (non-blocking, best-effort).
    after(() => ingestVaultMemory(businessId, user.id, transcript, { source: 'aichatpanel' }));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API] /api/ai/memorize POST error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
