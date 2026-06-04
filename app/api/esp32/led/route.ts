import { NextRequest, NextResponse } from 'next/server';
import { esp32Store } from '@/app/api/esp32/store';

export async function POST(request: NextRequest) {
  try {
    const { macAddress, ledStatus } = await request.json();

    if (!macAddress || !ledStatus) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['off', 'blinking'].includes(ledStatus)) {
      return NextResponse.json({ error: 'Invalid ledStatus' }, { status: 400 });
    }

    esp32Store.upsertDevice(macAddress, {
      ledStatus,
      lastSeen: new Date().toISOString(),
    });

    esp32Store.addEvent({
      type: 'telemetry',
      macAddress,
      timestamp: new Date().toISOString(),
      data: { ledStatus },
    });

    return NextResponse.json({ success: true, macAddress, ledStatus });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
