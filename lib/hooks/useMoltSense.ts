'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  storageUtils,
  Cell,
  MoltEvent,
  Hub,
  UndiscoveredDevice,
  Alert,
  RackSet,
} from '@/lib/localStorage';

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
