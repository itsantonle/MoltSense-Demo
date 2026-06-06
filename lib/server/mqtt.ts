import mqtt from 'mqtt';
import type { Esp32Config } from '@/lib/localStorage';

const MQTT_BROKER_URL =
  'mqtts://2178b9fe17a0404da089a93620721834.s1.eu.hivemq.cloud:8883';
const MQTT_USERNAME = 'moltsense';
const MQTT_PASSWORD = '!Moltsense123';

type PublishOptions = {
  retain?: boolean;
  qos?: 0 | 1 | 2;
};

type MqttJsonPayload = Record<string, unknown>;

type MqttSubscriptionResult = {
  topic: string;
  payload: MqttJsonPayload;
};

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
  console.log('[mqtt][publish] sending', {
    topic,
    qos: options.qos ?? 1,
    retain: options.retain ?? false,
    payloadKeys: Object.keys(payload),
  });

  await new Promise<void>((resolve, reject) => {
    const client = createClient();
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      client.end(true, {}, () => {
        if (error) {
          console.error('[mqtt][publish] failed', {
            topic,
            error: error.message,
          });
          reject(error);
        } else {
          console.log('[mqtt][publish] sent', { topic });
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

export const requestMqttJson = async (
  requestTopic: string,
  responseTopic: string,
  payload: MqttJsonPayload,
  options: PublishOptions & { timeoutMs?: number } = {}
) => {
  const timeoutMs = options.timeoutMs ?? 10_000;
  console.log('[mqtt][request] sending', {
    requestTopic,
    responseTopic,
    timeoutMs,
  });

  return await new Promise<MqttSubscriptionResult>((resolve, reject) => {
    const client = createClient();
    let settled = false;
    let timeoutHandle: NodeJS.Timeout | undefined;

    const finish = (error?: Error, result?: MqttSubscriptionResult) => {
      if (settled) return;
      settled = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      client.end(true, {}, () => {
        if (error) {
          console.error('[mqtt][request] failed', {
            requestTopic,
            responseTopic,
            error: error.message,
          });
          reject(error);
        } else {
          console.log('[mqtt][request] received response', {
            responseTopic,
            topic: result?.topic,
          });
          resolve(result as MqttSubscriptionResult);
        }
      });
    };

    client.on('connect', () => {
      client.subscribe(responseTopic, { qos: options.qos ?? 1 }, (subscribeError) => {
        if (subscribeError) {
          finish(subscribeError);
          return;
        }

        client.publish(
          requestTopic,
          JSON.stringify(payload),
          {
            qos: options.qos ?? 1,
            retain: options.retain ?? false,
          },
          (publishError) => {
            if (publishError) {
              finish(publishError);
            }
          }
        );
      });
    });

    client.on('message', (topic, message) => {
      if (topic !== responseTopic) return;
      try {
        const parsed = JSON.parse(message.toString()) as MqttJsonPayload;
        finish(undefined, { topic, payload: parsed });
      } catch (error) {
        finish(error instanceof Error ? error : new Error('Failed to parse MQTT response'));
      }
    });

    client.on('error', (error) => {
      finish(error);
    });

    timeoutHandle = setTimeout(() => {
      finish(new Error(`Timed out waiting for MQTT response on ${responseTopic}`));
    }, timeoutMs);
  });
};

export const publishEsp32Config = async (
  macAddress: string,
  config: Esp32Config,
  metadata: Record<string, unknown> = {}
) => {
  const normalizedMac = normalizeMacAddress(macAddress);
  console.log('[mqtt][config] publishing ESP32 config', {
    macAddress: normalizedMac,
    metadata,
  });
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
  console.log('[mqtt][ota] publishing firmware update', {
    macAddress: normalizedMac,
    metadata,
    payload,
  });
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

export const requestEsp32ConfigSnapshot = async (
  macAddress: string,
  metadata: Record<string, unknown> = {},
  timeoutMs = 10_000
) => {
  const normalizedMac = normalizeMacAddress(macAddress);
  const requestTopic = `esp32/${normalizedMac}/config/request`;
  const responseTopic = `esp32/${normalizedMac}/config/state`;

  const response = await requestMqttJson(
    requestTopic,
    responseTopic,
    {
      ...metadata,
      macAddress: normalizedMac,
      requestedAt: new Date().toISOString(),
      request: 'config-snapshot',
    },
    { qos: 1, retain: false, timeoutMs }
  );

  return response.payload;
};
