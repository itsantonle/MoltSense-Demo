import { NextRequest, NextResponse } from 'next/server';
import { requestEsp32ConfigSnapshot } from '@/lib/server/mqtt';

const parseConfigPayload = (payload: Record<string, unknown>) => {
  const config = payload.config;
  if (!config || typeof config !== 'object') return null;
  return config as Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  try {
    const { macAddress } = await request.json();
    if (!macAddress) {
      return NextResponse.json({ error: 'Missing macAddress' }, { status: 400 });
    }

    const payload = await requestEsp32ConfigSnapshot(macAddress, {
      source: 'web-config-request',
    });
    const config = parseConfigPayload(payload);
    if (!config) {
      return NextResponse.json(
        {
          error: 'Invalid MQTT response payload',
          payload,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      macAddress,
      payload,
      config,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown MQTT request error',
      },
      { status: 500 }
    );
  }
}
