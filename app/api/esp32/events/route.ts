import { NextRequest, NextResponse } from 'next/server';
import { esp32Store } from '@/app/api/esp32/store';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const since = Number(searchParams.get('since') || 0);
  const events = esp32Store.getEventsSince(Number.isFinite(since) ? since : 0);

  return NextResponse.json({
    success: true,
    serverTime: new Date().toISOString(),
    config: esp32Store.getConfig(),
    events,
  });
}
