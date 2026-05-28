import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { moltEventId, macAddress } = await request.json();

    if (!moltEventId || !macAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Return acknowledgement
    // Frontend will update the molt event status
    return NextResponse.json(
      {
        success: true,
        message: 'Molt event acknowledged',
        moltEventId,
        acknowledgedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
