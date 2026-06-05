import { NextRequest, NextResponse } from 'next/server';
import { esp32Store } from '@/app/api/esp32/store';

export async function POST(request: NextRequest) {
  try {
    const { moltEventId, macAddress } = await request.json();

    if (!macAddress) {
      return NextResponse.json(
        { error: 'Missing required macAddress' },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();

    esp32Store.upsertDevice(macAddress, {
      ledStatus: 'off',
      lastSeen: timestamp,
    });

    esp32Store.addEvent({
      type: 'ack',
      macAddress,
      timestamp,
      data: {
        ...(moltEventId ? { moltEventId } : {}),
        acknowledgedAll: !moltEventId,
      },
    });

    // Return acknowledgement
    // Frontend will update the molt event status
    return NextResponse.json(
      {
        success: true,
        message: moltEventId
          ? 'Molt event acknowledged'
          : 'All molt events for the device acknowledged',
        moltEventId,
        acknowledgedAll: !moltEventId,
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
