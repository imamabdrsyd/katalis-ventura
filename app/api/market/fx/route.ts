import { NextResponse } from 'next/server';
import { getFxRate } from '@/lib/marketData/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await getFxRate();
  return NextResponse.json(result);
}
