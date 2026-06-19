import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getAuthenticatedUser } from '@/lib/supabase-server';

import { loadSession, saveMessages } from '@/lib/ai/memory';

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId');
    const sessionId = searchParams.get('sessionId');

    if (!businessId || !sessionId) {
      return NextResponse.json({ error: 'Missing businessId or sessionId' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data: roleData } = await supabase
      .from('user_business_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('business_id', businessId)
      .single();
    if (!roleData) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const messages = await loadSession(businessId, user.id, sessionId);
    return NextResponse.json({ messages });
  } catch (err) {
    console.error('[API] /api/ai/memory GET error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { businessId, sessionId, messages } = body;

    if (!businessId || !sessionId || !Array.isArray(messages)) {
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

    // Validate messages shape
    const validMessages = messages.filter(m => m.role && m.content).map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content as string,
      metadata: m.metadata
    }));

    await saveMessages(businessId, user.id, sessionId, validMessages);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API] /api/ai/memory POST error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
