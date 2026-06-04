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
    const inferredMolt =
      hasConductivity &&
      (moltDetected ||
        ((previousDevice?.lastConductivity === undefined ||
          previousDevice.lastConductivity < config.conductivityThresholdStart) &&
          numericConductivity >= config.conductivityThresholdStart &&
          numericConductivity <= config.conductivityThresholdEnd));

    let device = esp32Store.upsertDevice(macAddress, {
      lastSeen: timestamp,
      signalStrength,
      lastConductivity: hasConductivity ? numericConductivity : previousDevice?.lastConductivity,
    });

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
        eventId: telemetryEvent.id,
        moltEventId,
        moltDetected: inferredMolt,
        config,
        ledConfig: { status: device.ledStatus },
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
