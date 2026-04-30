import { NextResponse } from 'next/server';
import { rejectJoinRequest } from '@/lib/api/joinRequests';

export async function POST(
  request: Request,
  { params }: { params: { requestId: string } }
) {
  try {
    const body = await request.json();
    const { reviewerId } = body;

    if (!reviewerId) {
      return NextResponse.json({ error: 'reviewerId is required' }, { status: 400 });
    }

    await rejectJoinRequest(params.requestId, reviewerId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error rejecting request:', error);
    return NextResponse.json({ error: 'Failed to reject request' }, { status: 500 });
  }
}
