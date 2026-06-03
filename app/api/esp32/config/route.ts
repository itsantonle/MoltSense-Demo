import { NextRequest, NextResponse } from 'next/server';
import { esp32Store } from '@/app/api/esp32/store';

const allowedKeys = new Set([
  'conductivityThresholdStart',
  'conductivityThresholdEnd',
  'moistureThresholdLow',
  'moistureThresholdHigh',
  'moltCooldownMs',
  'moistureIntervalMs',
  'conductivityIntervalMs',
  'errorAfterMs',
]);

const pickConfigUpdates = (payload: Record<string, unknown>) => {
  const updates: Record<string, number> = {};
  Object.keys(payload).forEach((key) => {
    if (!allowedKeys.has(key)) return;
    const value = Number(payload[key]);
    if (Number.isFinite(value)) updates[key] = value;
  });
  return updates;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const macAddress = searchParams.get('macAddress');
  if (macAddress) {
    return NextResponse.json({
      success: true,
      macAddress,
      config: esp32Store.resolveConfig(macAddress),
      overrides: esp32Store.getDeviceConfig(macAddress) ?? {},
    });
  }

  return NextResponse.json({
    success: true,
    config: esp32Store.getConfig(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const { macAddress, updates, scope } = await request.json();

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'Missing updates' }, { status: 400 });
    }

    const filteredUpdates = pickConfigUpdates(updates);

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
    }

    if (scope === 'device' && macAddress) {
      esp32Store.setDeviceConfig(macAddress, filteredUpdates);
      return NextResponse.json({
        success: true,
        scope: 'device',
        macAddress,
        config: esp32Store.resolveConfig(macAddress),
        overrides: esp32Store.getDeviceConfig(macAddress),
      });
    }

    if (scope === 'all') {
      esp32Store.setConfig(filteredUpdates);
      const store = esp32Store.get();
      Object.keys(store.devices).forEach((deviceMac) => {
        esp32Store.setDeviceConfig(deviceMac, filteredUpdates);
      });
      return NextResponse.json({
        success: true,
        scope: 'all',
        config: esp32Store.getConfig(),
      });
    }

    esp32Store.setConfig(filteredUpdates);
    return NextResponse.json({
      success: true,
      scope: 'global',
      config: esp32Store.getConfig(),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const macAddress = searchParams.get('macAddress');
    if (!macAddress) {
      return NextResponse.json({ error: 'Missing macAddress' }, { status: 400 });
    }

    esp32Store.clearDeviceConfig(macAddress);
    return NextResponse.json({ success: true, macAddress });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
