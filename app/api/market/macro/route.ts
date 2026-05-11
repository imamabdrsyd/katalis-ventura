import { NextRequest, NextResponse } from 'next/server';
import { getMacroSeries } from '@/lib/marketData/service';
import { DEFAULT_FRED_SERIES, FRED_SERIES } from '@/lib/marketData/constants';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const seriesId = request.nextUrl.searchParams.get('series') ?? DEFAULT_FRED_SERIES;
  if (!FRED_SERIES[seriesId]) {
    return NextResponse.json(
      { error: `Unknown FRED series: ${seriesId}` },
      { status: 400 }
    );
  }
  const result = await getMacroSeries(seriesId);
  return NextResponse.json(result);
}
