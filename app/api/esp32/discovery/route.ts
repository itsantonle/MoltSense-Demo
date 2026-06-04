import { NextResponse } from 'next/server';
import { esp32Store } from '@/app/api/esp32/store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const store = esp32Store.get();
  const devices = Object.values(store.devices)
    .filter((device) => !device.registered)
    .map((device) => ({
      macAddress: device.macAddress,
      firstSeen: device.lastSeen,
      lastSeen: device.lastSeen,
      signalStrength: device.signalStrength ?? 80,
    }));

  return NextResponse.json(
    {
      success: true,
      serverTime: new Date().toISOString(),
      devices,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  );
}
