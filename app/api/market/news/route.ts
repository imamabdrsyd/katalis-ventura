import { NextRequest, NextResponse } from 'next/server';
import { getStockNews, getVcPeSmeArticles } from '@/lib/marketData/service';
import { CACHE_TTL } from '@/lib/marketData/constants';
import { withRouteTiming } from '@/lib/api/server/timing';

function cacheControl(seconds: number): string {
  return `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`;
}

export async function GET(request: NextRequest) {
  return withRouteTiming(request, '/api/market/news', async () => {
    const type = request.nextUrl.searchParams.get('type') ?? 'stock';
    const isArticles = type === 'articles';
    const result = isArticles ? await getVcPeSmeArticles() : await getStockNews();
    const ttl = isArticles ? CACHE_TTL.RSS_GENERAL_ARTICLES : CACHE_TTL.RSS_STOCK_NEWS;

    return NextResponse.json(result, {
      headers: { 'Cache-Control': cacheControl(ttl) },
    });
  });
}
