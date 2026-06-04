import { NextRequest, NextResponse } from 'next/server';
import { esp32Store } from '@/app/api/esp32/store';

export async function POST(request: NextRequest) {
  try {
    const { moltEventId, macAddress } = await request.json();

    if (!moltEventId || !macAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();

    esp32Store.upsertDevice(macAddress, {
      ledStatus: 'off',
      moltAcknowledged: true,
      lastSeen: timestamp,
    });

    esp32Store.addEvent({
      type: 'ack',
      macAddress,
      timestamp,
      data: { moltEventId },
    });

    // Return acknowledgement
    // Frontend will update the molt event status
    return NextResponse.json(
      {
        success: true,
        message: 'Molt event acknowledged',
        moltEventId,
        acknowledgedAt: timestamp,
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
