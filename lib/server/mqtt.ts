import mqtt from 'mqtt';
import type { Esp32Config } from '@/lib/localStorage';

const MQTT_BROKER_URL =
  process.env.HIVEMQ_MQTT_URL ??
  'mqtts';
const MQTT_USERNAME = process.env.HIVEMQ_MQTT_USERNAME ?? 'username';
const MQTT_PASSWORD = process.env.HIVEMQ_MQTT_PASSWORD ?? 'password';

type PublishOptions = {
  retain?: boolean;
  qos?: 0 | 1 | 2;
};

type MqttJsonPayload = Record<string, unknown>;

const normalizeMacAddress = (macAddress: string) => macAddress.trim().toLowerCase();

const createClient = () => {
  return mqtt.connect(MQTT_BROKER_URL, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    clientId: `moltsense-web-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    reconnectPeriod: 0,
    connectTimeout: 10_000,
    rejectUnauthorized: false,
  });
};

export const publishMqttJson = async (
  topic: string,
  payload: MqttJsonPayload,
  options: PublishOptions = {}
) => {
  await new Promise<void>((resolve, reject) => {
    const client = createClient();
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      client.end(true, {}, () => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    };

    client.on('connect', () => {
      client.publish(
        topic,
        JSON.stringify(payload),
        {
          qos: options.qos ?? 1,
          retain: options.retain ?? false,
        },
        (error) => {
          if (error) {
            finish(error);
            return;
          }
          finish();
        }
      );
    });

    client.on('error', (error) => {
      finish(error);
    });

    client.on('close', () => {
      if (!settled) {
        finish(new Error('MQTT connection closed before publish completed'));
      }
    });
  });
};

export const publishEsp32Config = async (
  macAddress: string,
  config: Esp32Config,
  metadata: Record<string, unknown> = {}
) => {
  const normalizedMac = normalizeMacAddress(macAddress);
  await publishMqttJson(
    `esp32/${normalizedMac}/config`,
    {
      ...metadata,
      macAddress: normalizedMac,
      updatedAt: new Date().toISOString(),
      config,
    },
    { retain: true, qos: 1 }
  );
};

export const publishEsp32FirmwareUpdate = async (
  macAddress: string,
  payload: {
    firmwareUrl: string;
    version?: string;
    checksum?: string;
    reason?: string;
  },
  metadata: Record<string, unknown> = {}
) => {
  const normalizedMac = normalizeMacAddress(macAddress);
  await publishMqttJson(
    `esp32/${normalizedMac}/ota`,
    {
      ...metadata,
      macAddress: normalizedMac,
      requestedAt: new Date().toISOString(),
      ...payload,
    },
    { retain: false, qos: 1 }
  );
};
