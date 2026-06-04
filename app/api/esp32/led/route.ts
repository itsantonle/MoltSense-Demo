import { NextRequest, NextResponse } from 'next/server';
import { esp32Store } from '@/app/api/esp32/store';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const macAddress = searchParams.get('macAddress');

  if (!macAddress) {
    return NextResponse.json({ error: 'Missing macAddress' }, { status: 400 });
  }

  const device = esp32Store.getDevice(macAddress);
  return NextResponse.json({
    success: true,
    macAddress,
    ledStatus: device?.ledStatus ?? 'off',
  });
}

export async function POST(request: NextRequest) {
  try {
    const { macAddress, ledStatus } = await request.json();

    if (!macAddress || !ledStatus) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['on', 'off', 'blinking'].includes(ledStatus)) {
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
