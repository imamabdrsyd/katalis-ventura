import { NextRequest, NextResponse } from 'next/server';
import { getStockNews, getVcPeSmeArticles } from '@/lib/marketData/service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type') ?? 'stock';
  const result = type === 'articles' ? await getVcPeSmeArticles() : await getStockNews();
  return NextResponse.json(result);
}
