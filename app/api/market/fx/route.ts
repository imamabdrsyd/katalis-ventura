import { NextRequest, NextResponse } from 'next/server';
import { getFxRate } from '@/lib/marketData/service';
import { CACHE_TTL } from '@/lib/marketData/constants';
import { SUPPORTED_CURRENCIES } from '@/lib/currency';
import { withRouteTiming } from '@/lib/api/server/timing';

const CACHE_CONTROL = `public, s-maxage=${CACHE_TTL.EXCHANGE_RATE}, stale-while-revalidate=${CACHE_TTL.EXCHANGE_RATE * 2}`;

export async function GET(request: NextRequest) {
  return withRouteTiming(request, '/api/market/fx', async () => {
    const from = (request.nextUrl.searchParams.get('from') ?? 'USD').toUpperCase();
    if (!SUPPORTED_CURRENCIES.includes(from as typeof SUPPORTED_CURRENCIES[number]) || from === 'IDR') {
      return NextResponse.json(
        { error: `Unsupported currency: ${from}` },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    const result = await getFxRate(from, 'IDR');
    return NextResponse.json(result, {
      headers: { 'Cache-Control': CACHE_CONTROL },
    });
  });
}
