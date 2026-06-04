'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  storageUtils,
  Cell,
  MoltEvent,
  Hub,
  UndiscoveredDevice,
  Alert,
  RackSet,
} from '@/lib/localStorage';

const normalizeMacAddress = (value: string) => value.trim().toLowerCase();

export const useMoltSense = () => {
  const [cells, setCells] = useState<Cell[]>([]);
  const [moltEvents, setMoltEvents] = useState<MoltEvent[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [undiscoveredDevices, setUndiscoveredDevices] = useState<
    UndiscoveredDevice[]
  >([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [sets, setSets] = useState<RackSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const lastEventIdRef = useRef(0);
  const reflectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load
  useEffect(() => {
    const loadData = () => {
      setCells(storageUtils.getCells());
      setMoltEvents(storageUtils.getMoltEvents());
      setHubs(storageUtils.getHubs());
      setUndiscoveredDevices(storageUtils.getUndiscoveredDevices());
      setAlerts(storageUtils.getAlerts());
      setSets(storageUtils.getSets());
      setIsLoading(false);
    };

    loadData();

    // Set up polling for simulated ESP32 data
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const syncEsp32Events = async () => {
      try {
        const response = await fetch(`/api/esp32/events?since=${lastEventIdRef.current}`, {
          cache: 'no-store',
        });
        if (!response.ok) return;
        const payload = await response.json();
        const events = payload?.events ?? [];
        if (!Array.isArray(events) || events.length === 0) return;

        const now = new Date().toISOString();
        const existingEvents = storageUtils.getMoltEvents();
        const existingEventIds = new Set(existingEvents.map((event) => event.id));
        const nextAlerts = storageUtils.getAlerts();

        events.forEach((event: { id: number; type: string; macAddress: string; timestamp: string; data?: Record<string, unknown> }) => {
          lastEventIdRef.current = Math.max(lastEventIdRef.current, event.id);
          const cellsSnapshot = storageUtils.getCells();
          const eventMac = normalizeMacAddress(event.macAddress);
          const cell = cellsSnapshot.find((item) => normalizeMacAddress(item.macAddress) === eventMac);
          const timestamp = event.timestamp || now;

          if (!cell) {
            const existing = storageUtils.getUndiscoveredDevices().find(
              (device) => normalizeMacAddress(device.macAddress) === eventMac
            );
            storageUtils.addUndiscoveredDevice({
              macAddress: event.macAddress,
              firstSeen: existing?.firstSeen ?? timestamp,
              lastSeen: timestamp,
              signalStrength: Number(event.data?.signalStrength ?? 80),
            });
            setUndiscoveredDevices(storageUtils.getUndiscoveredDevices());
            return;
          }

          if (event.type === 'register') {
            const existing = storageUtils.getUndiscoveredDevices().find(
              (device) => normalizeMacAddress(device.macAddress) === eventMac
            );
            storageUtils.addUndiscoveredDevice({
              macAddress: event.macAddress,
              firstSeen: existing?.firstSeen ?? timestamp,
              lastSeen: timestamp,
              signalStrength: Number(event.data?.signalStrength ?? 80),
            });
            setUndiscoveredDevices(storageUtils.getUndiscoveredDevices());
          }

          if (event.type === 'telemetry') {
            storageUtils.updateCell(cell.id, {
              pressure: Number(event.data?.pressure ?? cell.pressure),
              moisture: Number(event.data?.moisture ?? cell.moisture),
              bioimpedance: Number(event.data?.conductivity ?? cell.bioimpedance),
              temperature: Number(event.data?.temperature ?? cell.temperature),
              humidity: Number(event.data?.humidity ?? cell.humidity),
              ledStatus: (event.data?.ledStatus as Cell['ledStatus']) ?? cell.ledStatus,
            });
          }

          if (event.type === 'molt') {
            const moltEventId = String(event.data?.moltEventId ?? `molt-${event.id}`);
            if (!existingEventIds.has(moltEventId)) {
              const newEvent: MoltEvent = {
                id: moltEventId,
                cellId: cell.id,
                timestamp,
                duration: 4.5,
                acknowledged: false,
              };
              storageUtils.addMoltEvent(newEvent);
              existingEventIds.add(moltEventId);

              const alert: Alert = {
                id: `alert-${Date.now()}-${cell.id}`,
                cellId: cell.id,
                type: 'molt',
                message: 'Molt detected in cell',
                timestamp,
                read: false,
              };
              nextAlerts.push(alert);
              storageUtils.addAlert(alert);
            }
            storageUtils.updateCell(cell.id, {
              lastMolt: timestamp,
              ledStatus: 'on',
              status: 'active',
            });
          }

          if (event.type === 'error') {
            storageUtils.updateCell(cell.id, {
              status: 'error',
              ledStatus: 'blinking',
            });

            const alert: Alert = {
              id: `alert-${Date.now()}-${cell.id}`,
              cellId: cell.id,
              type: 'sensor_error',
              message: String(event.data?.message ?? 'Sensor error detected'),
              timestamp,
              read: false,
            };
            nextAlerts.push(alert);
            storageUtils.addAlert(alert);
          }

          if (event.type === 'ack') {
            const moltEventId = String(event.data?.moltEventId ?? '');
            if (moltEventId) {
              storageUtils.acknowledgeMoltEvent(moltEventId);
            }
            storageUtils.updateCell(cell.id, { ledStatus: 'off' });
          }
        });

        if (reflectionTimerRef.current) {
          clearTimeout(reflectionTimerRef.current);
        }

        reflectionTimerRef.current = setTimeout(() => {
          setCells(storageUtils.getCells());
          setMoltEvents(storageUtils.getMoltEvents());
          setAlerts(storageUtils.getAlerts());
          setUndiscoveredDevices(storageUtils.getUndiscoveredDevices());
        }, 250);
      } catch (error) {
        console.warn('Failed to sync ESP32 events', error);
      }
    };

    syncEsp32Events();
    const interval = setInterval(syncEsp32Events, 3000);
    return () => {
      clearInterval(interval);
      if (reflectionTimerRef.current) {
        clearTimeout(reflectionTimerRef.current);
      }
    };
  }, []);

  const addCell = useCallback(
    (cell: Cell) => {
      storageUtils.addCell(cell);
      setCells(storageUtils.getCells());
    },
    []
  );

  const updateCell = useCallback((id: string, updates: Partial<Cell>) => {
    storageUtils.updateCell(id, updates);
    setCells(storageUtils.getCells());
  }, []);

  const removeCell = useCallback((id: string) => {
    storageUtils.removeCell(id);
    setCells(storageUtils.getCells());
  }, []);

  const addMoltEvent = useCallback((event: MoltEvent) => {
    storageUtils.addMoltEvent(event);
    setMoltEvents(storageUtils.getMoltEvents());

    // Create alert
    const alert: Alert = {
      id: `alert-${Date.now()}`,
      cellId: event.cellId,
      type: 'molt',
      message: `Molt detected in cell`,
      timestamp: event.timestamp,
      read: false,
    };
    storageUtils.addAlert(alert);
    setAlerts(storageUtils.getAlerts());
  }, []);

  const acknowledgeMoltEvent = useCallback((id: string) => {
    storageUtils.acknowledgeMoltEvent(id);
    setMoltEvents(storageUtils.getMoltEvents());
  }, []);

  const addUndiscoveredDevice = useCallback(
    (device: UndiscoveredDevice) => {
      storageUtils.addUndiscoveredDevice(device);
      setUndiscoveredDevices(storageUtils.getUndiscoveredDevices());
    },
    []
  );

  const removeUndiscoveredDevice = useCallback((macAddress: string) => {
    storageUtils.removeUndiscoveredDevice(macAddress);
    setUndiscoveredDevices(storageUtils.getUndiscoveredDevices());
  }, []);

  const markAlertAsRead = useCallback((id: string) => {
    storageUtils.markAlertAsRead(id);
    setAlerts(storageUtils.getAlerts());
  }, []);

  const clearAllAlerts = useCallback(() => {
    storageUtils.clearAllAlerts();
    setAlerts(storageUtils.getAlerts());
  }, []);

  const addSet = useCallback((set: RackSet) => {
    storageUtils.addSet(set);
    setSets(storageUtils.getSets());
  }, []);

  const updateSet = useCallback((id: string, updates: Partial<RackSet>) => {
    storageUtils.updateSet(id, updates);
    setSets(storageUtils.getSets());
  }, []);

  const deleteSet = useCallback((id: string) => {
    storageUtils.deleteSet(id);
    setSets(storageUtils.getSets());
  }, []);

  return {
    cells,
    moltEvents,
    hubs,
    undiscoveredDevices,
    alerts,
    sets,
    isLoading,
    addCell,
    updateCell,
    removeCell,
    addMoltEvent,
    acknowledgeMoltEvent,
    addUndiscoveredDevice,
    removeUndiscoveredDevice,
    markAlertAsRead,
    clearAllAlerts,
    addSet,
    updateSet,
    deleteSet,
  };
};
