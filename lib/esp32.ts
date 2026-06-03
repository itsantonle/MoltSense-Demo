import type { Esp32Config } from '@/lib/localStorage';

export const sendLedCommand = async (
  macAddress: string,
  ledStatus: 'on' | 'off' | 'blinking'
) => {
  try {
    await fetch('/api/esp32/led', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ macAddress, ledStatus }),
    });
  } catch (error) {
    console.warn('Failed to send LED command', error);
  }
};

export const acknowledgeMolt = async (macAddress: string, moltEventId: string) => {
  try {
    await fetch('/api/molt/acknowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ macAddress, moltEventId }),
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
