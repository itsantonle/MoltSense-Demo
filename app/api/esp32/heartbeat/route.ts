import { NextRequest, NextResponse } from 'next/server';
import { esp32Store } from '@/app/api/esp32/store';

const mockTemperature = () => 23 + Math.random() * 3;
const mockHumidity = () => 72 + Math.random() * 8;

export async function POST(request: NextRequest) {
  try {
    const {
      macAddress,
      moisture,
      conductivity,
      pressure,
      temperature,
      humidity,
      moltDetected,
      errorDetected,
      signalStrength,
      ledStatus,
    } = await request.json();

    if (!macAddress) {
      return NextResponse.json(
        { error: 'Missing MAC address' },
        { status: 400 }
      );
    }

    const registeredDevice = esp32Store.getDevice(macAddress);

    const timestamp = new Date().toISOString();
    const config = esp32Store.resolveConfig(macAddress);
    const previousDevice = registeredDevice;
    const numericConductivity = Number(conductivity);
    const hasConductivity = Number.isFinite(numericConductivity);
    const telemetryIntervalMs = Math.max(config.moistureIntervalMs || 0, 1000);
    const previousTelemetryAt = previousDevice?.lastTelemetryAt
      ? new Date(previousDevice.lastTelemetryAt).getTime()
      : 0;
    const telemetryDue =
      previousTelemetryAt === 0 ||
      Date.now() - previousTelemetryAt >= telemetryIntervalMs;
    const previousConductivity = previousDevice?.lastConductivity;
    const conductivityBelowTrigger =
      previousConductivity === undefined ||
      previousConductivity < config.conductivityThresholdStart;
    const conductivityAboveTrigger =
      hasConductivity && numericConductivity >= config.conductivityThresholdStart;
    const inferredMolt =
      hasConductivity &&
      (moltDetected ||
        (conductivityBelowTrigger && conductivityAboveTrigger));
    const inferredMoltEventId = inferredMolt ? `molt-${macAddress}-${Date.now()}` : undefined;

    console.log('[esp32/heartbeat] received', {
      macAddress,
      conductivity,
      inferredMolt,
      moltDetected,
      errorDetected,
      previousConductivity,
      telemetryIntervalMs,
    });

    let device = esp32Store.upsertDevice(macAddress, {
      registered: registeredDevice?.registered ?? false,
      lastSeen: timestamp,
      signalStrength,
      lastConductivity: hasConductivity
        ? numericConductivity
        : previousDevice?.lastConductivity,
      ledStatus: ledStatus ?? previousDevice?.ledStatus ?? 'off',
      moltAcknowledged:
        inferredMolt ? false : ledStatus === 'off' ? true : previousDevice?.moltAcknowledged ?? true,
    });

    let telemetryEventId: number | undefined;
    let moltEventId: string | undefined;
    if (telemetryDue || inferredMolt || errorDetected) {
      const telemetryEvent = esp32Store.addEvent({
        type: 'telemetry',
        macAddress,
        timestamp,
        data: {
          moisture,
          conductivity,
          pressure,
          temperature: Number.isFinite(temperature) ? temperature : mockTemperature(),
          humidity: Number.isFinite(humidity) ? humidity : mockHumidity(),
          signalStrength,
          ledStatus: device.ledStatus || 'off',
          moltDetected: inferredMolt,
          moltEventId: inferredMoltEventId,
        },
      });
      telemetryEventId = telemetryEvent.id;
      device = esp32Store.upsertDevice(macAddress, {
        lastTelemetryAt: timestamp,
      });
    }

    if (inferredMolt) {
      moltEventId = inferredMoltEventId;
      device = esp32Store.upsertDevice(macAddress, {
        registered: true,
        ledStatus: 'on',
        moltAcknowledged: false,
        lastMoltAt: timestamp,
      });
      esp32Store.addEvent({
        type: 'molt',
        macAddress,
        timestamp,
        data: {
          moltEventId,
        },
      });
      console.log('[esp32/heartbeat] molt event stored', {
        macAddress,
        moltEventId,
        timestamp,
      });
    }

    if (errorDetected) {
      esp32Store.upsertDevice(macAddress, {
        registered: true,
        errorState: true,
      });
      esp32Store.addEvent({
        type: 'error',
        macAddress,
        timestamp,
        data: {
          code: 'SENSOR_FAULT',
          message: 'Sensor stuck or reporting invalid readings',
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Heartbeat received',
        timestamp,
        macAddress,
        eventId: telemetryEventId,
        moltEventId,
        moltDetected: inferredMolt,
        config,
        ledConfig: { status: device.ledStatus },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
