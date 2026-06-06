// LocalStorage utility for MoltSense app
// Handles data persistence across sessions

export interface Cell {
  id: string;
  alias?: string;
  macAddress: string;
  hubId: string;
  rackId?: string;
  cellNumber: number;
  status: 'active' | 'inactive' | 'error';
  lastMolt?: string;
  nextMoltEstimate?: string;
  ledStatus: 'on' | 'off' | 'blinking';
  moistureState?: 'low' | 'normal' | 'high';
  pressure: number;
  moisture: number;
  bioimpedance: number;
  temperature: number;
  humidity: number;
  esp32Config?: Partial<Esp32Config>;
}

export interface MoltEvent {
  id: string;
  cellId: string;
  macAddress?: string;
  timestamp: string;
  duration: number; // Duration in hours
  acknowledged: boolean;
  acknowledgedAt?: string;
}

export interface Hub {
  id: string;
  name: string;
  macAddress: string;
  cellCapacity: number;
  cells: string[];
  lastHeartbeat: string;
  status: 'online' | 'offline';
}

export interface Rack {
  id: string;
  name: string;
  alias?: string;
  hubId: string;
  setId: string;
  cellLimit: number; // User-configurable limit
  cells: string[]; // Cell IDs in order
  createdAt: string;
}

export interface RackSet {
  id: string;
  name: string;
  rackIds: string[]; // Rack IDs in order
  createdAt: string;
  esp32Config?: Partial<Esp32Config>;
}

export interface User {
  id: string;
  name: string;
  email: string;
  farm: string;
  avatar?: string;
}

export interface UndiscoveredDevice {
  macAddress: string;
  firstSeen: string;
  lastSeen: string;
  signalStrength: number;
}

export interface Alert {
  id: string;
  cellId: string;
  macAddress?: string;
  type: 'molt' | 'sensor_error' | 'offline' | 'moisture_low' | 'moisture_high';
  message: string;
  timestamp: string;
  read: boolean;
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

const STORAGE_KEYS = {
  CELLS: 'moltsense_cells',
  MOLT_EVENTS: 'moltsense_molt_events',
  HUBS: 'moltsense_hubs',
  RACKS: 'moltsense_racks',
  SETS: 'moltsense_sets',
  UNDISCOVERED: 'moltsense_undiscovered',
  ALERTS: 'moltsense_alerts',
  CURRENT_USER: 'moltsense_current_user',
  WEIGHT_UNIT: 'moltsense_weight_unit',
  TEMP_UNIT: 'moltsense_temp_unit',
  ESP32_CONFIG: 'moltsense_esp32_config',
  ESP32_DEVICE_CONFIG: 'moltsense_esp32_device_config',
};

type LegacyEsp32Config = Partial<Esp32Config> & {
  conductivityMin?: number;
  conductivityMax?: number;
  moistureLow?: number;
  moistureHigh?: number;
  conductivityThreshold?: number;
  moistureThreshold?: number;
};

const DEFAULT_ESP32_CONFIG: Esp32Config = {
  conductivityThresholdStart: 300,
  conductivityThresholdEnd: 200,
  moistureThresholdLow: 30,
  moistureThresholdHigh: 80,
  moltCooldownMs: 0,
  moistureIntervalMs: 5000,
  conductivityIntervalMs: 500,
  errorAfterMs: 7 * 24 * 60 * 60 * 1000,
};

const MIN_SENSOR_INTERVAL_MS = 1000;

const toFiniteNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeMacAddress = (value: string) => value.trim().toLowerCase();

const normalizeEsp32Config = (config?: LegacyEsp32Config | null): Esp32Config => ({
  conductivityThresholdStart: toFiniteNumber(
    config?.conductivityThresholdStart ?? config?.conductivityMin ?? config?.conductivityThreshold,
    DEFAULT_ESP32_CONFIG.conductivityThresholdStart
  ),
  conductivityThresholdEnd: toFiniteNumber(
    config?.conductivityThresholdEnd ?? config?.conductivityMax ?? config?.conductivityThreshold,
    DEFAULT_ESP32_CONFIG.conductivityThresholdEnd
  ),
  moistureThresholdLow: toFiniteNumber(
    config?.moistureThresholdLow ?? config?.moistureLow ?? config?.moistureThreshold,
    DEFAULT_ESP32_CONFIG.moistureThresholdLow
  ),
  moistureThresholdHigh: toFiniteNumber(
    config?.moistureThresholdHigh ?? config?.moistureHigh ?? config?.moistureThreshold,
    DEFAULT_ESP32_CONFIG.moistureThresholdHigh
  ),
  moltCooldownMs: toFiniteNumber(config?.moltCooldownMs, DEFAULT_ESP32_CONFIG.moltCooldownMs),
  moistureIntervalMs: Math.max(
    toFiniteNumber(config?.moistureIntervalMs, DEFAULT_ESP32_CONFIG.moistureIntervalMs),
    MIN_SENSOR_INTERVAL_MS
  ),
  conductivityIntervalMs: toFiniteNumber(
    config?.conductivityIntervalMs,
    DEFAULT_ESP32_CONFIG.conductivityIntervalMs
  ),
  errorAfterMs: toFiniteNumber(config?.errorAfterMs, DEFAULT_ESP32_CONFIG.errorAfterMs),
});

const normalizeEsp32ConfigWindow = (config: Esp32Config): Esp32Config => ({
  ...config,
  conductivityThresholdStart: Math.max(
    config.conductivityThresholdStart,
    config.conductivityThresholdEnd
  ),
  conductivityThresholdEnd: Math.min(
    config.conductivityThresholdStart,
    config.conductivityThresholdEnd
  ),
  moistureThresholdLow: Math.min(config.moistureThresholdLow, config.moistureThresholdHigh),
  moistureThresholdHigh: Math.max(config.moistureThresholdLow, config.moistureThresholdHigh),
});

const normalizeEsp32ConfigPatch = (config?: LegacyEsp32Config | null): Partial<Esp32Config> => {
  if (!config) return {};

  const patch: Partial<Esp32Config> = {};
  if (
    config.conductivityThresholdStart !== undefined ||
    config.conductivityMin !== undefined ||
    config.conductivityThreshold !== undefined
  ) {
    patch.conductivityThresholdStart = toFiniteNumber(
      config.conductivityThresholdStart ?? config.conductivityMin ?? config.conductivityThreshold,
      DEFAULT_ESP32_CONFIG.conductivityThresholdStart
    );
  }
  if (
    config.conductivityThresholdEnd !== undefined ||
    config.conductivityMax !== undefined ||
    config.conductivityThreshold !== undefined
  ) {
    patch.conductivityThresholdEnd = toFiniteNumber(
      config.conductivityThresholdEnd ?? config.conductivityMax ?? config.conductivityThreshold,
      DEFAULT_ESP32_CONFIG.conductivityThresholdEnd
    );
  }
  if (
    config.moistureThresholdLow !== undefined ||
    config.moistureLow !== undefined ||
    config.moistureThreshold !== undefined
  ) {
    patch.moistureThresholdLow = toFiniteNumber(
      config.moistureThresholdLow ?? config.moistureLow ?? config.moistureThreshold,
      DEFAULT_ESP32_CONFIG.moistureThresholdLow
    );
  }
  if (
    config.moistureThresholdHigh !== undefined ||
    config.moistureHigh !== undefined ||
    config.moistureThreshold !== undefined
  ) {
    patch.moistureThresholdHigh = toFiniteNumber(
      config.moistureThresholdHigh ?? config.moistureHigh ?? config.moistureThreshold,
      DEFAULT_ESP32_CONFIG.moistureThresholdHigh
    );
  }
  if (config.moltCooldownMs !== undefined) {
    patch.moltCooldownMs = toFiniteNumber(config.moltCooldownMs, DEFAULT_ESP32_CONFIG.moltCooldownMs);
  }
  if (config.moistureIntervalMs !== undefined) {
    patch.moistureIntervalMs = Math.max(
      toFiniteNumber(config.moistureIntervalMs, DEFAULT_ESP32_CONFIG.moistureIntervalMs),
      MIN_SENSOR_INTERVAL_MS
    );
  }
  if (config.conductivityIntervalMs !== undefined) {
    patch.conductivityIntervalMs = toFiniteNumber(
      config.conductivityIntervalMs,
      DEFAULT_ESP32_CONFIG.conductivityIntervalMs
    );
  }
  if (config.errorAfterMs !== undefined) {
    patch.errorAfterMs = toFiniteNumber(config.errorAfterMs, DEFAULT_ESP32_CONFIG.errorAfterMs);
  }

  return patch;
};

const mergeEsp32Configs = (
  base: Esp32Config,
  override?: LegacyEsp32Config | null
): Esp32Config => normalizeEsp32Config({ ...base, ...(override ?? {}) });

// Initialize default data
const initializeDefaults = () => {
  if (typeof window === 'undefined') return;

  const existing = localStorage.getItem(STORAGE_KEYS.CELLS);
  if (!existing) {
    const defaultHubs: Hub[] = [
      {
        id: 'hub-1',
        name: 'Hub 1',
        macAddress: '00:1A:2B:3C:4D:5E',
        cellCapacity: 48,
        cells: [],
        lastHeartbeat: new Date().toISOString(),
        status: 'online',
      },
    ];
    localStorage.setItem(STORAGE_KEYS.HUBS, JSON.stringify(defaultHubs));
  }

  // Initialize sets and racks if they don't exist
  const existingSets = localStorage.getItem(STORAGE_KEYS.SETS);
  const existingRacks = localStorage.getItem(STORAGE_KEYS.RACKS);
  if (!existingSets || !existingRacks) {
    const now = new Date().toISOString();
    const defaultSet: RackSet = {
      id: 'set-default',
      name: 'Default',
      rackIds: ['rack-1'],
      createdAt: now,
    };
    const defaultRacks: Rack[] = [
      {
        id: 'rack-1',
        name: 'Rack A',
        hubId: 'hub-1',
        setId: defaultSet.id,
        cellLimit: 48,
        cells: [],
        createdAt: now,
      },
    ];

    localStorage.setItem(STORAGE_KEYS.SETS, JSON.stringify([defaultSet]));
    localStorage.setItem(STORAGE_KEYS.RACKS, JSON.stringify(defaultRacks));
  }

  // Initialize empty cells storage if it doesn't exist
  const existingCells = localStorage.getItem(STORAGE_KEYS.CELLS);
  if (!existingCells) {
    localStorage.setItem(STORAGE_KEYS.CELLS, JSON.stringify([]));
  }
};

const ensureSets = () => {
  if (typeof window === 'undefined') return;
  const setsData = localStorage.getItem(STORAGE_KEYS.SETS);
  const racksData = localStorage.getItem(STORAGE_KEYS.RACKS);
  if (!setsData || !racksData) {
    initializeDefaults();
    return;
  }

  const sets: RackSet[] = JSON.parse(setsData);
  const racks: Rack[] = JSON.parse(racksData);

  if (sets.length === 0) {
    const now = new Date().toISOString();
    const fallbackSet: RackSet = {
      id: 'set-default',
      name: 'Default',
      rackIds: [],
      createdAt: now,
    };
    sets.push(fallbackSet);
  }

  const defaultSet = sets.find((set) => set.id === 'set-default') || sets[0];

  racks.forEach((rack) => {
    if (!rack.setId) {
      rack.setId = defaultSet.id;
    }
  });

  const rackIdsInSets = new Set(sets.flatMap((set) => set.rackIds));
  racks.forEach((rack) => {
    if (!rackIdsInSets.has(rack.id)) {
      defaultSet.rackIds.push(rack.id);
    }
  });

  localStorage.setItem(STORAGE_KEYS.SETS, JSON.stringify(sets));
  localStorage.setItem(STORAGE_KEYS.RACKS, JSON.stringify(racks));
};

export const storageUtils = {
  reindexCellsInRack: (rackId: string) => {
    if (typeof window === 'undefined') return;
    const racks = storageUtils.getRacks();
    const rack = racks.find((r) => r.id === rackId);
    if (!rack) return;
    const cells = storageUtils.getCells();
    const rackCells = cells
      .filter((cell) => cell.rackId === rackId)
      .sort((a, b) => a.cellNumber - b.cellNumber);

    rackCells.forEach((cell, index) => {
      cell.cellNumber = index + 1;
    });
    rack.cells = rackCells.map((cell) => cell.id);

    localStorage.setItem(STORAGE_KEYS.CELLS, JSON.stringify(cells));
    localStorage.setItem(STORAGE_KEYS.RACKS, JSON.stringify(racks));
  },
  // Sets
  getSets: (): RackSet[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEYS.SETS);
    if (!data) {
      initializeDefaults();
      return storageUtils.getSets();
    }
    return JSON.parse(data);
  },

  addSet: (set: RackSet) => {
    if (typeof window === 'undefined') return;
    const sets = storageUtils.getSets();
    sets.push(set);
    localStorage.setItem(STORAGE_KEYS.SETS, JSON.stringify(sets));
  },

  updateSet: (id: string, updates: Partial<RackSet>) => {
    if (typeof window === 'undefined') return;
    const sets = storageUtils.getSets();
    const index = sets.findIndex((s) => s.id === id);
    if (index !== -1) {
      sets[index] = { ...sets[index], ...updates };
      localStorage.setItem(STORAGE_KEYS.SETS, JSON.stringify(sets));
    }
  },

  getSetEsp32Config: (setId: string): Partial<Esp32Config> => {
    if (typeof window === 'undefined') return {};
    const set = storageUtils.getSets().find((item) => item.id === setId);
    return normalizeEsp32ConfigPatch(set?.esp32Config ?? {});
  },

  setSetEsp32Config: (setId: string, updates: Partial<Esp32Config>) => {
    if (typeof window === 'undefined') return;
    const sets = storageUtils.getSets();
    const index = sets.findIndex((set) => set.id === setId);
    if (index === -1) return;
    sets[index] = {
      ...sets[index],
      esp32Config: {
        ...(sets[index].esp32Config ?? {}),
        ...normalizeEsp32ConfigPatch(updates as LegacyEsp32Config),
      },
    };
    localStorage.setItem(STORAGE_KEYS.SETS, JSON.stringify(sets));
  },

  clearSetEsp32Config: (setId: string) => {
    if (typeof window === 'undefined') return;
    const sets = storageUtils.getSets();
    const index = sets.findIndex((set) => set.id === setId);
    if (index === -1) return;
    const nextSet = { ...sets[index] };
    delete nextSet.esp32Config;
    sets[index] = nextSet;
    localStorage.setItem(STORAGE_KEYS.SETS, JSON.stringify(sets));
  },

  deleteSet: (id: string) => {
    if (typeof window === 'undefined') return;
    const sets = storageUtils.getSets().filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SETS, JSON.stringify(sets));
  },
  // Cells
  getCells: (): Cell[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEYS.CELLS);
    return data ? JSON.parse(data) : [];
  },

  addCell: (cell: Cell) => {
    if (typeof window === 'undefined') return;
    const cells = storageUtils.getCells();
    cells.push(cell);
    localStorage.setItem(STORAGE_KEYS.CELLS, JSON.stringify(cells));
  },

  updateCell: (id: string, updates: Partial<Cell>) => {
    if (typeof window === 'undefined') return;
    const cells = storageUtils.getCells();
    const index = cells.findIndex((c) => c.id === id);
    if (index !== -1) {
      cells[index] = { ...cells[index], ...updates };
      localStorage.setItem(STORAGE_KEYS.CELLS, JSON.stringify(cells));
    }
  },

  getCellEsp32Config: (cellId: string): Partial<Esp32Config> => {
    if (typeof window === 'undefined') return {};
    const cell = storageUtils.getCells().find((item) => item.id === cellId);
    return normalizeEsp32ConfigPatch(cell?.esp32Config ?? {});
  },

  setCellEsp32Config: (cellId: string, updates: Partial<Esp32Config>) => {
    if (typeof window === 'undefined') return;
    const cells = storageUtils.getCells();
    const index = cells.findIndex((cell) => cell.id === cellId);
    if (index === -1) return;
    cells[index] = {
      ...cells[index],
      esp32Config: {
        ...(cells[index].esp32Config ?? {}),
        ...normalizeEsp32ConfigPatch(updates as LegacyEsp32Config),
      },
    };
    localStorage.setItem(STORAGE_KEYS.CELLS, JSON.stringify(cells));
  },

  clearCellEsp32Config: (cellId: string) => {
    if (typeof window === 'undefined') return;
    const cells = storageUtils.getCells();
    const index = cells.findIndex((cell) => cell.id === cellId);
    if (index === -1) return;
    const nextCell = { ...cells[index] };
    delete nextCell.esp32Config;
    cells[index] = nextCell;
    localStorage.setItem(STORAGE_KEYS.CELLS, JSON.stringify(cells));
  },

  removeCell: (id: string) => {
    if (typeof window === 'undefined') return;
    const cells = storageUtils.getCells();
    const target = cells.find((cell) => cell.id === id);
    const targetMac = target?.macAddress ? normalizeMacAddress(target.macAddress) : undefined;
    const remaining = cells.filter((cell) => cell.id !== id);
    localStorage.setItem(STORAGE_KEYS.CELLS, JSON.stringify(remaining));

    const remainingEvents = storageUtils
      .getMoltEvents()
      .filter((event) => {
        if (event.cellId === id) return false;
        if (!targetMac || !event.macAddress) return true;
        return normalizeMacAddress(event.macAddress) !== targetMac;
      });
    localStorage.setItem(STORAGE_KEYS.MOLT_EVENTS, JSON.stringify(remainingEvents));

    const remainingAlerts = storageUtils
      .getAlerts()
      .filter((alert) => {
        if (alert.cellId === id) return false;
        if (!targetMac || !alert.macAddress) return true;
        return normalizeMacAddress(alert.macAddress) !== targetMac;
      });
    localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(remainingAlerts));

    if (target?.macAddress) {
      storageUtils.clearEsp32DeviceConfig(target.macAddress);
    }

    if (target?.rackId) {
      const racks = storageUtils.getRacks();
      const rack = racks.find((item) => item.id === target.rackId);
      if (rack) {
        rack.cells = rack.cells.filter((cellId) => cellId !== id);
        localStorage.setItem(STORAGE_KEYS.RACKS, JSON.stringify(racks));
      }
      storageUtils.reindexCellsInRack(target.rackId);
    }

    const hubs = storageUtils.getHubs();
    hubs.forEach((hub) => {
      if (hub.cells.includes(id)) {
        hub.cells = hub.cells.filter((cellId) => cellId !== id);
      }
    });
    localStorage.setItem(STORAGE_KEYS.HUBS, JSON.stringify(hubs));

    if (targetMac) {
      const undiscovered = storageUtils
        .getUndiscoveredDevices()
        .filter((device) => normalizeMacAddress(device.macAddress) !== targetMac);
      localStorage.setItem(STORAGE_KEYS.UNDISCOVERED, JSON.stringify(undiscovered));
    }
  },

  // Molt Events
  getMoltEvents: (): MoltEvent[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEYS.MOLT_EVENTS);
    return data ? JSON.parse(data) : [];
  },

  addMoltEvent: (event: MoltEvent) => {
    if (typeof window === 'undefined') return;
    const events = storageUtils.getMoltEvents();
    events.push(event);
    localStorage.setItem(STORAGE_KEYS.MOLT_EVENTS, JSON.stringify(events));
  },

  acknowledgeMoltEvent: (id: string) => {
    if (typeof window === 'undefined') return;
    const events = storageUtils.getMoltEvents();
    const index = events.findIndex((e) => e.id === id);
    if (index !== -1) {
      events[index] = {
        ...events[index],
        acknowledged: true,
        acknowledgedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEYS.MOLT_EVENTS, JSON.stringify(events));
    }
  },

  acknowledgeMoltEventsByCell: (cellId: string) => {
    if (typeof window === 'undefined') return;
    const events = storageUtils.getMoltEvents();
    const acknowledgedAt = new Date().toISOString();
    let updated = false;

    events.forEach((event) => {
      if (event.cellId === cellId && !event.acknowledged) {
        event.acknowledged = true;
        event.acknowledgedAt = acknowledgedAt;
        updated = true;
      }
    });

    if (updated) {
      localStorage.setItem(STORAGE_KEYS.MOLT_EVENTS, JSON.stringify(events));
    }
  },

  // Hubs
  getHubs: (): Hub[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEYS.HUBS);
    if (!data) {
      initializeDefaults();
      return storageUtils.getHubs();
    }
    return JSON.parse(data);
  },

  addHub: (hub: Hub) => {
    if (typeof window === 'undefined') return;
    const hubs = storageUtils.getHubs();
    hubs.push(hub);
    localStorage.setItem(STORAGE_KEYS.HUBS, JSON.stringify(hubs));
  },

  updateHub: (id: string, updates: Partial<Hub>) => {
    if (typeof window === 'undefined') return;
    const hubs = storageUtils.getHubs();
    const index = hubs.findIndex((h) => h.id === id);
    if (index !== -1) {
      hubs[index] = { ...hubs[index], ...updates };
      localStorage.setItem(STORAGE_KEYS.HUBS, JSON.stringify(hubs));
    }
  },

  // Undiscovered Devices
  getUndiscoveredDevices: (): UndiscoveredDevice[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEYS.UNDISCOVERED);
    const devices: UndiscoveredDevice[] = data ? JSON.parse(data) : [];
    const registeredMacs = new Set(
      storageUtils.getCells().map((cell) => normalizeMacAddress(cell.macAddress))
    );
    const filtered = devices.filter(
      (device) => !registeredMacs.has(normalizeMacAddress(device.macAddress))
    );

    if (filtered.length !== devices.length) {
      localStorage.setItem(STORAGE_KEYS.UNDISCOVERED, JSON.stringify(filtered));
    }

    return filtered;
  },

  addUndiscoveredDevice: (device: UndiscoveredDevice) => {
    if (typeof window === 'undefined') return;
    const devices = storageUtils.getUndiscoveredDevices();
    const deviceMac = normalizeMacAddress(device.macAddress);
    const registeredMacs = new Set(
      storageUtils.getCells().map((cell) => normalizeMacAddress(cell.macAddress))
    );

    if (registeredMacs.has(deviceMac)) {
      localStorage.setItem(STORAGE_KEYS.UNDISCOVERED, JSON.stringify(devices));
      return;
    }

    const existing = devices.find((d) => normalizeMacAddress(d.macAddress) === deviceMac);
    if (existing) {
      existing.lastSeen = device.lastSeen;
      existing.signalStrength = device.signalStrength;
    } else {
      devices.push(device);
    }
    localStorage.setItem(STORAGE_KEYS.UNDISCOVERED, JSON.stringify(devices));
  },

  removeUndiscoveredDevice: (macAddress: string) => {
    if (typeof window === 'undefined') return;
    const targetMac = normalizeMacAddress(macAddress);
    const devices = storageUtils
      .getUndiscoveredDevices()
      .filter((d) => normalizeMacAddress(d.macAddress) !== targetMac);
    localStorage.setItem(STORAGE_KEYS.UNDISCOVERED, JSON.stringify(devices));
  },

  // Alerts
  getAlerts: (): Alert[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEYS.ALERTS);
    return data ? JSON.parse(data) : [];
  },

  addAlert: (alert: Alert) => {
    if (typeof window === 'undefined') return;
    const alerts = storageUtils.getAlerts();
    alerts.push(alert);
    localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(alerts));
  },

  markAlertAsRead: (id: string) => {
    if (typeof window === 'undefined') return;
    const alerts = storageUtils.getAlerts();
    const index = alerts.findIndex((a) => a.id === id);
    if (index !== -1) {
      alerts[index].read = true;
      localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(alerts));
    }
  },

  clearAllAlerts: () => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify([]));
  },

  // Racks
  getRacks: (): Rack[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEYS.RACKS);
    return data ? JSON.parse(data) : [];
  },

  addRack: (rack: Rack) => {
    if (typeof window === 'undefined') return;
    const racks = storageUtils.getRacks();
    racks.push(rack);
    localStorage.setItem(STORAGE_KEYS.RACKS, JSON.stringify(racks));
    const sets = storageUtils.getSets();
    const setIndex = sets.findIndex((s) => s.id === rack.setId);
    if (setIndex !== -1 && !sets[setIndex].rackIds.includes(rack.id)) {
      sets[setIndex].rackIds.push(rack.id);
      localStorage.setItem(STORAGE_KEYS.SETS, JSON.stringify(sets));
    }
  },

  updateRack: (id: string, updates: Partial<Rack>) => {
    if (typeof window === 'undefined') return;
    const racks = storageUtils.getRacks();
    const index = racks.findIndex((r) => r.id === id);
    if (index !== -1) {
      racks[index] = { ...racks[index], ...updates };
      localStorage.setItem(STORAGE_KEYS.RACKS, JSON.stringify(racks));
    }
  },

  deleteRack: (id: string) => {
    if (typeof window === 'undefined') return;
    const racks = storageUtils.getRacks();
    const remaining = racks.filter((r) => r.id !== id);
    localStorage.setItem(STORAGE_KEYS.RACKS, JSON.stringify(remaining));

    const sets = storageUtils.getSets();
    const updatedSets = sets.map((set) => ({
      ...set,
      rackIds: set.rackIds.filter((rackId) => rackId !== id),
    }));
    localStorage.setItem(STORAGE_KEYS.SETS, JSON.stringify(updatedSets));

    const cells = storageUtils.getCells();
    cells.forEach((cell) => {
      if (cell.rackId === id) {
        cell.rackId = undefined;
      }
    });
    localStorage.setItem(STORAGE_KEYS.CELLS, JSON.stringify(cells));
  },

  addCellToRack: (rackId: string, cellId: string) => {
    if (typeof window === 'undefined') return;
    const racks = storageUtils.getRacks();
    const rack = racks.find((r) => r.id === rackId);
    if (rack && !rack.cells.includes(cellId)) {
      rack.cells.push(cellId);
      localStorage.setItem(STORAGE_KEYS.RACKS, JSON.stringify(racks));
      storageUtils.updateCell(cellId, { rackId });
    }
  },

  removeCellFromRack: (rackId: string, cellId: string) => {
    if (typeof window === 'undefined') return;
    const racks = storageUtils.getRacks();
    const rack = racks.find((r) => r.id === rackId);
    if (rack) {
      rack.cells = rack.cells.filter((c) => c !== cellId);
      localStorage.setItem(STORAGE_KEYS.RACKS, JSON.stringify(racks));
      storageUtils.updateCell(cellId, { rackId: undefined });
      storageUtils.reindexCellsInRack(rackId);
    }
  },

  reorderCellsInRack: (rackId: string, cellIds: string[]) => {
    if (typeof window === 'undefined') return;
    const racks = storageUtils.getRacks();
    const rack = racks.find((r) => r.id === rackId);
    if (rack) {
      rack.cells = cellIds;
      localStorage.setItem(STORAGE_KEYS.RACKS, JSON.stringify(racks));
    }
  },

  reorderRacksInSet: (setId: string, rackIds: string[]) => {
    if (typeof window === 'undefined') return;
    const sets = storageUtils.getSets();
    const set = sets.find((s) => s.id === setId);
    if (set) {
      set.rackIds = rackIds;
      localStorage.setItem(STORAGE_KEYS.SETS, JSON.stringify(sets));
    }
  },

  getCellsByRack: (rackId: string): Cell[] => {
    if (typeof window === 'undefined') return [];
    const cells = storageUtils.getCells();
    return cells.filter((c) => c.rackId === rackId);
  },

  getRecentMoltCells: (limit: number = 5): Cell[] => {
    if (typeof window === 'undefined') return [];
    const cells = storageUtils.getCells();
    return cells
      .filter((c) => c.lastMolt)
      .sort((a, b) => {
        const timeA = new Date(a.lastMolt || 0).getTime();
        const timeB = new Date(b.lastMolt || 0).getTime();
        return timeB - timeA;
      })
      .slice(0, limit);
  },

  // Users
  getCurrentUser: (): User | null => {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return data ? JSON.parse(data) : null;
  },

  setCurrentUser: (user: User) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  },

  getWeightUnit: (): 'g' | 'kg' | 'lb' => {
    if (typeof window === 'undefined') return 'g';
    const data = localStorage.getItem(STORAGE_KEYS.WEIGHT_UNIT);
    if (data === 'kg' || data === 'lb' || data === 'g') return data;
    return 'g';
  },

  setWeightUnit: (unit: 'g' | 'kg' | 'lb') => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.WEIGHT_UNIT, unit);
  },

  getTempUnit: (): 'c' | 'f' => {
    if (typeof window === 'undefined') return 'c';
    const data = localStorage.getItem(STORAGE_KEYS.TEMP_UNIT);
    if (data === 'f' || data === 'c') return data;
    return 'c';
  },

  setTempUnit: (unit: 'c' | 'f') => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.TEMP_UNIT, unit);
  },
  getEsp32Config: (): Esp32Config => {
    if (typeof window === 'undefined') {
      return normalizeEsp32ConfigWindow({ ...DEFAULT_ESP32_CONFIG });
    }
    const data = localStorage.getItem(STORAGE_KEYS.ESP32_CONFIG);
    if (data) return normalizeEsp32ConfigWindow(normalizeEsp32Config(JSON.parse(data) as LegacyEsp32Config));
    localStorage.setItem(STORAGE_KEYS.ESP32_CONFIG, JSON.stringify(DEFAULT_ESP32_CONFIG));
    return normalizeEsp32ConfigWindow({ ...DEFAULT_ESP32_CONFIG });
  },
  setEsp32Config: (config: Esp32Config) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(
      STORAGE_KEYS.ESP32_CONFIG,
      JSON.stringify(normalizeEsp32ConfigWindow(normalizeEsp32Config(config)))
    );
  },
  resolveEsp32ConfigForCell: (cellId: string): Esp32Config => {
    if (typeof window === 'undefined') return normalizeEsp32ConfigWindow({ ...DEFAULT_ESP32_CONFIG });
    const cell = storageUtils.getCells().find((item) => item.id === cellId);
    if (!cell) return storageUtils.getEsp32Config();

    const parentSet = cell.rackId
      ? storageUtils.getSets().find((item) => item.rackIds.includes(cell.rackId as string))
      : undefined;

    return normalizeEsp32ConfigWindow(
      mergeEsp32Configs(
      mergeEsp32Configs(
        storageUtils.getEsp32Config(),
        parentSet?.esp32Config as LegacyEsp32Config | undefined
      ),
      cell.esp32Config as LegacyEsp32Config | undefined
      )
    );
  },
  getEsp32DeviceConfig: (macAddress: string): Partial<Esp32Config> => {
    if (typeof window === 'undefined') return {};
    const data = localStorage.getItem(STORAGE_KEYS.ESP32_DEVICE_CONFIG);
    if (!data) return {};
    const map = JSON.parse(data) as Record<string, LegacyEsp32Config>;
    return normalizeEsp32ConfigPatch(map[macAddress]);
  },
  getEsp32DeviceConfigs: (): Record<string, Partial<Esp32Config>> => {
    if (typeof window === 'undefined') return {};
    const data = localStorage.getItem(STORAGE_KEYS.ESP32_DEVICE_CONFIG);
    if (!data) return {};
    const map = JSON.parse(data) as Record<string, LegacyEsp32Config>;
    return Object.fromEntries(
      Object.entries(map).map(([macAddress, config]) => [macAddress, normalizeEsp32ConfigPatch(config)])
    );
  },
  setEsp32DeviceConfig: (macAddress: string, updates: Partial<Esp32Config>) => {
    if (typeof window === 'undefined') return;
    const data = localStorage.getItem(STORAGE_KEYS.ESP32_DEVICE_CONFIG);
    const map = data ? (JSON.parse(data) as Record<string, LegacyEsp32Config>) : {};
    map[macAddress] = {
      ...(map[macAddress] ?? {}),
      ...normalizeEsp32ConfigPatch(updates as LegacyEsp32Config),
    };
    localStorage.setItem(STORAGE_KEYS.ESP32_DEVICE_CONFIG, JSON.stringify(map));
  },
  clearEsp32DeviceConfig: (macAddress: string) => {
    if (typeof window === 'undefined') return;
    const data = localStorage.getItem(STORAGE_KEYS.ESP32_DEVICE_CONFIG);
    if (!data) return;
    const map = JSON.parse(data) as Record<string, LegacyEsp32Config>;
    const normalizedTarget = normalizeMacAddress(macAddress);
    Object.keys(map).forEach((key) => {
      if (normalizeMacAddress(key) === normalizedTarget) {
        delete map[key];
      }
    });
    localStorage.setItem(STORAGE_KEYS.ESP32_DEVICE_CONFIG, JSON.stringify(map));
  },
  clearAllEsp32DeviceConfigs: () => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.ESP32_DEVICE_CONFIG, JSON.stringify({}));
  },
};

// Initialize mock molt events and alerts
const initializeMockData = () => {
  if (typeof window === 'undefined') return;

  const existingMolts = localStorage.getItem(STORAGE_KEYS.MOLT_EVENTS);
  if (!existingMolts) {
    const mockMolts: MoltEvent[] = [
      {
        id: 'molt-1',
        cellId: 'cell-1',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 4.5,
        acknowledged: false,
      },
      {
        id: 'molt-2',
        cellId: 'cell-2',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 5.2,
        acknowledged: true,
      },
      {
        id: 'molt-3',
        cellId: 'cell-3',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 4.8,
        acknowledged: true,
      },
      {
        id: 'molt-4',
        cellId: 'cell-1',
        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 5.0,
        acknowledged: true,
      },
      {
        id: 'molt-5',
        cellId: 'cell-2',
        timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 4.7,
        acknowledged: true,
      },
    ];
    localStorage.setItem(STORAGE_KEYS.MOLT_EVENTS, JSON.stringify(mockMolts));
  }

  const existingAlerts = localStorage.getItem(STORAGE_KEYS.ALERTS);
  if (!existingAlerts) {
    const mockAlerts: Alert[] = [
      {
        id: 'alert-1',
        cellId: 'cell-3',
        type: 'molt',
        message: 'Molt detected in cell 1-B',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        read: false,
      },
      {
        id: 'alert-2',
        cellId: 'cell-1',
        type: 'molt',
        message: 'Molt detected in cell 1-A',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        read: true,
      },
      {
        id: 'alert-3',
        cellId: 'cell-2',
        type: 'molt',
        message: 'Molt detected in cell 2-A',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        read: true,
      },
      {
        id: 'alert-4',
        cellId: 'cell-1',
        type: 'sensor_error',
        message: 'Pressure sensor reading anomaly in cell 1-A',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        read: true,
      },
      {
        id: 'alert-5',
        cellId: 'cell-2',
        type: 'offline',
        message: 'Cell 2-A went offline',
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        read: true,
      },
    ];
    localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(mockAlerts));
  }
};

// Initialize on first load
if (typeof window !== 'undefined') {
  initializeDefaults();
  ensureSets();
  initializeMockData();
  // Set default user if not set
  const currentUser = storageUtils.getCurrentUser();
  if (!currentUser) {
    storageUtils.setCurrentUser({
      id: 'user-1',
      name: 'John Smith',
      email: 'john@moltsense.farm',
      farm: 'Coastal Crabs Farm',
      avatar: '👨‍🌾',
    });
  }
}
