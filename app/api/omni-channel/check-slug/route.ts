import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createAdminClient } from '@/lib/supabase-server';
import { isReservedSlug, isValidSlugFormat } from '@/lib/utils/slugUtils';

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const slug = request.nextUrl.searchParams.get('slug');
  const businessId = request.nextUrl.searchParams.get('businessId');

  if (!slug || slug.length < 3 || slug.length > 64) {
    return NextResponse.json({ available: false, reason: 'length' });
  }

  if (!isValidSlugFormat(slug)) {
    return NextResponse.json({ available: false, reason: 'format' });
  }

  if (isReservedSlug(slug)) {
    return NextResponse.json({ available: false, reason: 'reserved' });
  }

  const supabase = createAdminClient();
  const { data } = await supabase.rpc('is_slug_available', {
    p_slug: slug,
    p_exclude_business_id: businessId ?? null,
  });

  return NextResponse.json({ available: data === true });
}

// POST — bulk check multiple slugs at once
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const slugs: string[] = Array.isArray(body.slugs) ? body.slugs.slice(0, 10) : [];
  const businessId: string | null = body.businessId ?? null;

  const supabase = createAdminClient();
  const results: Record<string, boolean> = {};

  await Promise.all(
    slugs.map(async (s) => {
      if (!isValidSlugFormat(s) || isReservedSlug(s)) {
        results[s] = false;
        return;
      }
      const { data } = await supabase.rpc('is_slug_available', {
        p_slug: s,
        p_exclude_business_id: businessId,
      });
      results[s] = data === true;
    })
  );

  return NextResponse.json({ results });
}
