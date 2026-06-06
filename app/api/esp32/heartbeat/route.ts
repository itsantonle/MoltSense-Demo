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

    const timestamp = new Date().toISOString();
    const config = esp32Store.resolveConfig(macAddress);
    const previousDevice = esp32Store.getDevice(macAddress);
    const numericConductivity = Number(conductivity);
    const numericMoisture = Number(moisture);
    const actualLedStatus =
      ledStatus === 'on' || ledStatus === 'off' || ledStatus === 'blinking'
        ? ledStatus
        : previousDevice?.ledStatus ?? 'off';
    const hasConductivity = Number.isFinite(numericConductivity);
    const hasMoisture = Number.isFinite(numericMoisture);
    const conductivityHighThreshold = Math.max(
      config.conductivityThresholdStart,
      config.conductivityThresholdEnd
    );
    const conductivityLowThreshold = Math.min(
      config.conductivityThresholdStart,
      config.conductivityThresholdEnd
    );
    const moistureLowThreshold = Math.min(
      config.moistureThresholdLow,
      config.moistureThresholdHigh
    );
    const moistureHighThreshold = Math.max(
      config.moistureThresholdLow,
      config.moistureThresholdHigh
    );
    const currentMoistureState = hasMoisture
      ? numericMoisture <= moistureLowThreshold
        ? 'low'
        : numericMoisture >= moistureHighThreshold
          ? 'high'
          : 'normal'
      : previousDevice?.moistureState ?? 'normal';
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
      previousConductivity <= conductivityLowThreshold;
    const conductivityAboveTrigger =
      hasConductivity && numericConductivity >= conductivityHighThreshold;
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

    esp32Store.upsertDevice(macAddress, {
      lastSeen: timestamp,
      signalStrength,
      lastConductivity: hasConductivity
        ? numericConductivity
        : previousDevice?.lastConductivity,
      lastMoisture: hasMoisture ? numericMoisture : previousDevice?.lastMoisture,
      ledStatus: actualLedStatus,
      moistureState: currentMoistureState,
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
          ledStatus: actualLedStatus,
          moistureState: currentMoistureState,
          moltDetected: inferredMolt,
          moltEventId: inferredMoltEventId,
        },
      });
      telemetryEventId = telemetryEvent.id;
      esp32Store.upsertDevice(macAddress, {
        lastTelemetryAt: timestamp,
      });
    }

    if (inferredMolt) {
      moltEventId = inferredMoltEventId;
      esp32Store.upsertDevice(macAddress, {
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

    if (
      hasMoisture &&
      currentMoistureState !== 'normal' &&
      currentMoistureState !== (previousDevice?.moistureState ?? 'normal')
    ) {
      esp32Store.addEvent({
        type: 'moisture',
        macAddress,
        timestamp,
        data: {
          moisture: numericMoisture,
          moistureState: currentMoistureState,
          lowThreshold: moistureLowThreshold,
          highThreshold: moistureHighThreshold,
        },
      });
    }

    if (errorDetected) {
      esp32Store.upsertDevice(macAddress, {
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
        ledConfig: { status: actualLedStatus },
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
