import type { Esp32Config } from '@/lib/localStorage';

export const sendLedCommand = async () => {
  console.warn('LED control is hardware-only. Software commands are disabled.');
};

export const acknowledgeMolt = async (macAddress: string, moltEventId?: string) => {
  try {
    await fetch('/api/molt/acknowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        macAddress,
        ...(moltEventId ? { moltEventId } : {}),
      }),
    });
  } catch (error) {
    console.warn('Failed to acknowledge molt', error);
  }
};

export const updateEsp32Config = async (
  updates: Partial<Esp32Config>,
  scope: 'global' | 'device' | 'all',
  macAddress?: string
) => {
  try {
    await fetch('/api/esp32/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates, scope, macAddress }),
    });
  } catch (error) {
    console.warn('Failed to update ESP32 config', error);
  }
};

export const requestEsp32ConfigSnapshot = async (macAddress: string) => {
  const requestRoute = '/api/esp32/config/request' as string;
  const response = await fetch(requestRoute, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ macAddress }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.details || error.error || 'Failed to request ESP32 config snapshot');
  }

  return (await response.json()) as {
    success: true;
    macAddress: string;
    payload: Record<string, unknown>;
    config: Esp32Config;
  };
};
