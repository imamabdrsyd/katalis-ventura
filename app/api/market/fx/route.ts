import { NextRequest, NextResponse } from 'next/server';
import { getFxRate } from '@/lib/marketData/service';
import { SUPPORTED_CURRENCIES } from '@/lib/currency';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const from = (request.nextUrl.searchParams.get('from') ?? 'USD').toUpperCase();
  if (!SUPPORTED_CURRENCIES.includes(from as typeof SUPPORTED_CURRENCIES[number]) || from === 'IDR') {
    return NextResponse.json({ error: `Unsupported currency: ${from}` }, { status: 400 });
  }
  const result = await getFxRate(from, 'IDR');
  return NextResponse.json(result);
}
