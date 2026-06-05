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

export async function POST() {
  return NextResponse.json(
    {
      error: 'LED control is read-only. Use hardware state and heartbeat telemetry instead.',
    },
    {
      status: 405,
      headers: {
        Allow: 'GET',
      },
    }
  );
}
