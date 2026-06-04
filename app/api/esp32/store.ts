export type Esp32EventType =
  | 'register'
  | 'undiscovered'
  | 'telemetry'
  | 'molt'
  | 'error'
  | 'ack';

export interface Esp32Event {
  id: number;
  type: Esp32EventType;
  macAddress: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface Esp32DeviceState {
  macAddress: string;
  registered: boolean;
  lastSeen: string;
  ledStatus: 'on' | 'off' | 'blinking';
  lastMoltAt?: string;
  lastTelemetryAt?: string;
  errorState?: boolean;
  signalStrength?: number;
  lastConductivity?: number;
}

export interface Esp32Config {
  conductivityThresholdStart: number;
  conductivityThresholdEnd: number;
  moistureThresholdLow: number;
  moistureThresholdHigh: number;
  moltCooldownMs: number;
  moistureIntervalMs: number;
  conductivityIntervalMs: number;
  errorAfterMs: number;
}

interface Esp32Store {
  nextId: number;
  events: Esp32Event[];
  devices: Record<string, Esp32DeviceState>;
  config: Esp32Config;
  deviceConfigs: Record<string, Partial<Esp32Config>>;
}

const DEFAULT_CONFIG: Esp32Config = {
  conductivityThresholdStart: 180,
  conductivityThresholdEnd: 200,
  moistureThresholdLow: 45,
  moistureThresholdHigh: 80,
  moltCooldownMs: 30 * 60 * 1000,
  moistureIntervalMs: 60000,
  conductivityIntervalMs: 300,
  errorAfterMs: 7 * 24 * 60 * 60 * 1000,
};

const MIN_HEARTBEAT_INTERVAL_MS = 60000;

const clampConfig = (updates: Partial<Esp32Config>): Partial<Esp32Config> => ({
  ...updates,
  ...(updates.moistureIntervalMs === undefined
    ? {}
    : { moistureIntervalMs: Math.max(updates.moistureIntervalMs, MIN_HEARTBEAT_INTERVAL_MS) }),
});

const getStore = (): Esp32Store => {
  const globalStore = globalThis as typeof globalThis & {
    __moltSenseEsp32Store?: Esp32Store;
  };
  if (!globalStore.__moltSenseEsp32Store) {
    globalStore.__moltSenseEsp32Store = {
      nextId: 1,
      events: [],
      devices: {},
      config: { ...DEFAULT_CONFIG },
      deviceConfigs: {},
    };
  }
  return globalStore.__moltSenseEsp32Store;
};

export const esp32Store = {
  get: getStore,
  getConfig: () => getStore().config,
  getDeviceConfig: (macAddress: string) => {
    const store = getStore();
    return store.deviceConfigs[macAddress];
  },
  setConfig: (updates: Partial<Esp32Config>) => {
    const store = getStore();
    store.config = { ...store.config, ...clampConfig(updates) };
  },
  setDeviceConfig: (macAddress: string, updates: Partial<Esp32Config>) => {
    const store = getStore();
    store.deviceConfigs[macAddress] = {
      ...(store.deviceConfigs[macAddress] ?? {}),
      ...clampConfig(updates),
    };
  },
  clearDeviceConfig: (macAddress: string) => {
    const store = getStore();
    delete store.deviceConfigs[macAddress];
  },
  resolveConfig: (macAddress: string) => {
    const store = getStore();
    return { ...store.config, ...(store.deviceConfigs[macAddress] ?? {}) };
  },
  getDevice: (macAddress: string) => {
    const store = getStore();
    return store.devices[macAddress];
  },
  upsertDevice: (macAddress: string, updates: Partial<Esp32DeviceState>) => {
    const store = getStore();
    const existing = store.devices[macAddress];
    const now = new Date().toISOString();
    store.devices[macAddress] = {
      macAddress,
      registered: existing?.registered ?? false,
      lastSeen: existing?.lastSeen ?? now,
      ledStatus: existing?.ledStatus ?? 'off',
      lastTelemetryAt: existing?.lastTelemetryAt,
      ...updates,
    };
    return store.devices[macAddress];
  },
  addEvent: (event: Omit<Esp32Event, 'id'>) => {
    const store = getStore();
    const nextEvent: Esp32Event = {
      ...event,
      id: store.nextId++,
    };
    store.events.push(nextEvent);
    if (store.events.length > 500) {
      store.events.splice(0, store.events.length - 500);
    }
    return nextEvent;
  },
  getEventsSince: (sinceId: number) => {
    const store = getStore();
    return store.events.filter((event) => event.id > sinceId);
  },
};
