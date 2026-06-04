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
    } = await request.json();

    if (!macAddress) {
      return NextResponse.json(
        { error: 'Missing MAC address' },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();
    const config = esp32Store.resolveConfig(macAddress);
    const previousDevice = esp32Store.getDevice(macAddress);
    const numericConductivity = Number(conductivity);
    const hasConductivity = Number.isFinite(numericConductivity);
    const TELEMETRY_EVENT_INTERVAL_MS = 60 * 1000;
    const previousTelemetryAt = previousDevice?.lastTelemetryAt
      ? new Date(previousDevice.lastTelemetryAt).getTime()
      : 0;
    const telemetryDue =
      previousTelemetryAt === 0 ||
      Date.now() - previousTelemetryAt >= TELEMETRY_EVENT_INTERVAL_MS;
    const inferredMolt =
      hasConductivity &&
      (moltDetected ||
        ((previousDevice?.lastConductivity === undefined ||
          previousDevice.lastConductivity < config.conductivityThresholdStart) &&
          numericConductivity >= config.conductivityThresholdStart));

    console.log('[esp32/heartbeat] received', {
      macAddress,
      conductivity,
      inferredMolt,
      moltDetected,
      errorDetected,
      previousConductivity: previousDevice?.lastConductivity,
    });

    let device = esp32Store.upsertDevice(macAddress, {
      lastSeen: timestamp,
      signalStrength,
      lastConductivity: hasConductivity ? numericConductivity : previousDevice?.lastConductivity,
    });

    let telemetryEventId: number | undefined;
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
        },
      });
      telemetryEventId = telemetryEvent.id;
      device = esp32Store.upsertDevice(macAddress, {
        lastTelemetryAt: timestamp,
      });
    }

    let moltEventId: string | undefined;
    if (inferredMolt) {
      moltEventId = `molt-${macAddress}-${Date.now()}`;
      device = esp32Store.upsertDevice(macAddress, {
        ledStatus: 'on',
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
        ledStatus: 'blinking',
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
