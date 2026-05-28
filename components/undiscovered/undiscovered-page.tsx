'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useMoltSense } from '@/lib/hooks/useMoltSense';
import { Cell, UndiscoveredDevice, Rack, RackSet } from '@/lib/localStorage';
import { storageUtils } from '@/lib/localStorage';
import { Wifi, Plus, CheckCircle, AlertCircle, RefreshCw, X } from 'lucide-react';
import gsap from 'gsap';

export function UndiscoveredPage() {
  const { undiscoveredDevices, addUndiscoveredDevice, removeUndiscoveredDevice, addCell, hubs, cells } =
    useMoltSense();
  const [isScanning, setIsScanning] = useState(false);
  const [showAddForm, setShowAddForm] = useState<string | null>(null);
  const [cellNumber, setCellNumber] = useState<string>('');
  const [selectedSetId, setSelectedSetId] = useState<string>('');
  const [selectedRackId, setSelectedRackId] = useState<string>('');
  const [sets, setSets] = useState<RackSet[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [formError, setFormError] = useState<string>('');
  const scannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const setsList = storageUtils.getSets();
    const racksList = storageUtils.getRacks();
    setSets(setsList);
    setRacks(racksList);
    if (setsList.length > 0 && !selectedSetId) {
      setSelectedSetId(setsList[0].id);
    }
  }, []);

  const racksForSelectedSet = racks.filter((rack) => rack.setId === selectedSetId);

  useEffect(() => {
    if (racksForSelectedSet.length > 0) {
      setSelectedRackId(racksForSelectedSet[0].id);
    } else {
      setSelectedRackId('');
    }
  }, [selectedSetId]);

  // Simulate scanning for devices
  const handleScan = async () => {
    setIsScanning(true);

    // Simulate scanning animation
    if (scannerRef.current) {
      gsap.fromTo(
        scannerRef.current,
        { opacity: 0.5 },
        { opacity: 1, duration: 0.3, yoyo: true, repeat: 5 }
      );
    }

    // Add random demo devices
    const demoMacs = [
      '00:1A:2B:3C:4D:61',
      '00:1A:2B:3C:4D:62',
      '00:1A:2B:3C:4D:63',
    ];

    for (const mac of demoMacs) {
      const existing = undiscoveredDevices.find((d) => d.macAddress === mac);
      if (!existing) {
        addUndiscoveredDevice({
          macAddress: mac,
          firstSeen: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          signalStrength: Math.floor(Math.random() * 40) + 60, // -60 to -20 dBm
        });
      }
    }

    setTimeout(() => setIsScanning(false), 2000);
  };

  const handleAddDevice = async (device: UndiscoveredDevice) => {
    if (!cellNumber || !hubs.length || !selectedRackId) return;

    const numericCell = Number(cellNumber);
    if (!Number.isInteger(numericCell) || numericCell <= 0) {
      setFormError('Cell number must be a positive number.');
      return;
    }

    const existingInRack = cells.find(
      (cell) => cell.rackId === selectedRackId && cell.cellNumber === numericCell
    );
    if (existingInRack) {
      setFormError('That cell number already exists in this rack.');
      return;
    }

    try {
      // Call ESP32 registration endpoint
      const response = await fetch('/api/esp32/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          macAddress: device.macAddress,
          cellNumber: numericCell,
          hubId: hubs[0].id,
        }),
      });

      if (response.ok) {
        // Create cell entry
        const generateId = () => Math.random().toString(36).substring(2, 11);
        const newCell: Cell = {
          id: `cell-${generateId()}`,
          macAddress: device.macAddress,
          hubId: hubs[0].id,
          rackId: selectedRackId,
          cellNumber: parseInt(cellNumber),
          status: 'active',
          ledStatus: 'off',
          pressure: 1200,
          moisture: 60,
          bioimpedance: 450,
          temperature: 24,
          humidity: 75,
        };

        addCell(newCell);
        // Add cell to rack
        storageUtils.addCellToRack(selectedRackId, newCell.id);
        removeUndiscoveredDevice(device.macAddress);
        setShowAddForm(null);
        setCellNumber('');
        setFormError('');
      }
    } catch (error) {
      console.error('Error registering device:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-cyan-500/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl font-bold text-slate-100 mb-2">
              My Cells
            </h1>
            <p className="text-slate-400 mb-6">
              Find and add new cell sensor pods to your farm
            </p>

            {/* Scan Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleScan}
              disabled={isScanning}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                isScanning
                  ? 'bg-cyan-500/50 text-slate-100 cursor-wait'
                  : 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 hover:shadow-lg hover:shadow-cyan-500/50'
              }`}
            >
              {isScanning ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Wifi className="w-5 h-5" />
                  Start Scan
                </>
              )}
            </motion.button>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {undiscoveredDevices.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div ref={scannerRef} className="inline-block mb-6">
              <div className="w-16 h-16 rounded-full border-4 border-cyan-500/30 border-t-cyan-500 animate-spin mx-auto" />
            </div>
            <p className="text-slate-400 mb-4">No undiscovered devices found</p>
            <p className="text-slate-500 text-sm">
              Make sure your ESP32 devices are powered and in range
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {undiscoveredDevices.map((device, idx) => (
              <motion.div
                key={device.macAddress}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="p-6 rounded-lg bg-gradient-to-br from-slate-800/50 to-slate-700/50 border border-cyan-500/20"
              >
                {showAddForm === device.macAddress ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-slate-100">Add Cell</h3>
                      <button
                        onClick={() => {
                          setShowAddForm(null);
                          setCellNumber('');
                          setFormError('');
                        }}
                        className="text-slate-400 hover:text-slate-200"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm text-slate-400 mb-2">
                        MAC Address
                      </label>
                      <input
                        type="text"
                        value={device.macAddress}
                        disabled
                        className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-600 text-slate-300 text-sm font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-slate-400 mb-2">
                        Select Set
                      </label>
                      <select
                        value={selectedSetId}
                        onChange={(e) => setSelectedSetId(e.target.value)}
                        className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-600 text-slate-100"
                      >
                        {sets.map((set) => (
                          <option key={set.id} value={set.id}>
                            {set.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-slate-400 mb-2">
                        Select Rack
                      </label>
                      <select
                        value={selectedRackId}
                        onChange={(e) => setSelectedRackId(e.target.value)}
                        className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-600 text-slate-100"
                        disabled={racksForSelectedSet.length === 0}
                      >
                        {racksForSelectedSet.map((rack) => (
                          <option key={rack.id} value={rack.id}>
                            {rack.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-slate-400 mb-2">
                        Cell Number
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={cellNumber}
                        onChange={(e) => {
                          setCellNumber(e.target.value);
                          setFormError('');
                        }}
                        placeholder="e.g., 5"
                        className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-600 text-slate-100 placeholder-slate-500"
                      />
                    </div>

                    {formError && (
                      <div className="rounded bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-300">
                        {formError}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleAddDevice(device)}
                        disabled={!cellNumber || !hubs.length || !selectedRackId || !!formError}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-teal-500 text-slate-900 font-bold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <CheckCircle className="w-4 h-4 inline mr-2" />
                        Add Cell
                      </motion.button>
                      <button
                        onClick={() => {
                          setShowAddForm(null);
                          setCellNumber('');
                        }}
                        className="flex-1 px-4 py-2 bg-slate-700 text-slate-300 font-bold rounded-lg hover:bg-slate-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-slate-100 mb-1 font-mono text-sm">
                          {device.macAddress}
                        </h3>
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                          <Wifi className="w-4 h-4" />
                          Signal: {device.signalStrength} dBm
                        </div>
                      </div>
                      <div className="px-2 py-1 rounded text-xs font-bold text-blue-400 bg-blue-500/20 border border-blue-500/50">
                        Undiscovered
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 mb-4 space-y-1">
                      <p>
                        First Seen:{' '}
                        {new Date(device.firstSeen).toLocaleTimeString()}
                      </p>
                      <p>
                        Last Seen:{' '}
                        {new Date(device.lastSeen).toLocaleTimeString()}
                      </p>
                    </div>

                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowAddForm(device.macAddress)}
                        className="w-full px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 font-bold rounded-lg hover:shadow-lg hover:shadow-cyan-500/50 transition-all flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add Cell
                      </motion.button>
                  </>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
