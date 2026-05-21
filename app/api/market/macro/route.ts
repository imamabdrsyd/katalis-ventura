import { NextRequest, NextResponse } from 'next/server';
import { getMacroSeries } from '@/lib/marketData/service';
import { CACHE_TTL, DEFAULT_FRED_SERIES, FRED_SERIES } from '@/lib/marketData/constants';
import { withRouteTiming } from '@/lib/api/server/timing';

const CACHE_CONTROL = `public, s-maxage=${CACHE_TTL.FRED_SERIES}, stale-while-revalidate=${CACHE_TTL.FRED_SERIES * 2}`;

export async function GET(request: NextRequest) {
  return withRouteTiming(request, '/api/market/macro', async () => {
    const seriesId = request.nextUrl.searchParams.get('series') ?? DEFAULT_FRED_SERIES;
    if (!FRED_SERIES[seriesId]) {
      return NextResponse.json(
        { error: `Unknown FRED series: ${seriesId}` },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    const result = await getMacroSeries(seriesId);
    return NextResponse.json(result, {
      headers: { 'Cache-Control': CACHE_CONTROL },
    });
  });
}
