'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { storageUtils, Rack, Cell, RackSet, MoltEvent } from '@/lib/localStorage';
import { formatTemperature, formatWeight, TemperatureUnit, WeightUnit } from '@/lib/utils';
import { Plus, Trash2, Edit2, GripVertical, Layers, Grid, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Link from 'next/link';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { sendLedCommand } from '@/lib/esp32';

const moveItem = <T,>(items: T[], fromIndex: number, toIndex: number): T[] => {
  const next = [...items];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  return next;
};

export function MyRacksPage() {
  const [sets, setSets] = useState<RackSet[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [moltEvents, setMoltEvents] = useState<MoltEvent[]>([]);
  const [showAddSet, setShowAddSet] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editingSetName, setEditingSetName] = useState('');
  const [editingRackId, setEditingRackId] = useState<string | null>(null);
  const [editingRackAlias, setEditingRackAlias] = useState('');
  const [editingRackCapacity, setEditingRackCapacity] = useState('');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('g');
  const [tempUnit, setTempUnit] = useState<TemperatureUnit>('c');
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [cellDialogOpen, setCellDialogOpen] = useState(false);
  const [cellAliasDraft, setCellAliasDraft] = useState('');
  const [draggingCellId, setDraggingCellId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description?: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    const loadData = () => {
      setSets(storageUtils.getSets());
      setRacks(storageUtils.getRacks());
      setCells(storageUtils.getCells());
      setMoltEvents(storageUtils.getMoltEvents());
      setWeightUnit(storageUtils.getWeightUnit());
      setTempUnit(storageUtils.getTempUnit());
      setIsLoading(false);
    };
    loadData();
  }, []);

  const racksById = useMemo(() => {
    return racks.reduce<Record<string, Rack>>((acc, rack) => {
      acc[rack.id] = rack;
      return acc;
    }, {});
  }, [racks]);

  const cellsById = useMemo(() => {
    return cells.reduce<Record<string, Cell>>((acc, cell) => {
      acc[cell.id] = cell;
      return acc;
    }, {});
  }, [cells]);

  const lastMoltByCellId = useMemo(() => {
    return moltEvents.reduce<Record<string, MoltEvent>>((acc, event) => {
      const existing = acc[event.cellId];
      if (!existing || new Date(event.timestamp) > new Date(existing.timestamp)) {
        acc[event.cellId] = event;
      }
      return acc;
    }, {});
  }, [moltEvents]);

  const refreshData = () => {
    const nextSets = storageUtils.getSets();
    const nextRacks = storageUtils.getRacks();
    const nextCells = storageUtils.getCells();
    const updatedRacks = nextRacks.map((rack) => {
      if (rack.cells.length > 0) return rack;
      const assignedCells = nextCells.filter((cell) => cell.rackId === rack.id);
      if (assignedCells.length === 0) return rack;
      return {
        ...rack,
        cells: assignedCells.map((cell) => cell.id),
      };
    });
    if (updatedRacks.some((rack, index) => rack.cells !== nextRacks[index].cells)) {
      localStorage.setItem('moltsense_racks', JSON.stringify(updatedRacks));
    }
    setSets(nextSets);
    setRacks(updatedRacks);
    setCells(nextCells);
  };

  const handleAddSet = () => {
    if (!newSetName.trim()) return;
    const now = new Date().toISOString();
    const newSet: RackSet = {
      id: `set-${Date.now()}`,
      name: newSetName.trim(),
      rackIds: [],
      createdAt: now,
    };
    storageUtils.addSet(newSet);
    refreshData();
    setNewSetName('');
    setShowAddSet(false);
  };

  const handleAddRack = (setId: string) => {
    const now = new Date().toISOString();
    const rackCount = racks.filter((rack) => rack.setId === setId).length + 1;
    const newRack: Rack = {
      id: `rack-${Date.now()}`,
      name: `Rack ${String.fromCharCode(64 + rackCount)}`,
      hubId: 'hub-1',
      setId,
      cellLimit: 48,
      cells: [],
      createdAt: now,
    };
    storageUtils.addRack(newRack);
    refreshData();
  };

  const handleDeleteRack = (rackId: string) => {
    setConfirmState({
      open: true,
      title: 'Delete rack?',
      description: 'This will unassign all cells from this rack.',
      onConfirm: () => {
        storageUtils.deleteRack(rackId);
        refreshData();
        setConfirmState({ open: false, title: '', onConfirm: () => {} });
      },
    });
  };

  const handleSaveRackSettings = (rackId: string) => {
    const parsedCapacity = Number(editingRackCapacity);
    const rack = racksById[rackId];
    const assignedCount = rack ? getOrderedCells(rack).length : 0;
    const normalizedCapacity = Number.isFinite(parsedCapacity)
      ? Math.max(assignedCount, Math.max(1, Math.floor(parsedCapacity)))
      : Math.max(assignedCount, 1);
    storageUtils.updateRack(rackId, {
      alias: editingRackAlias.trim() || undefined,
      cellLimit: normalizedCapacity,
    });
    refreshData();
    setEditingRackId(null);
    setEditingRackAlias('');
    setEditingRackCapacity('');
  };

  const handleRenameSet = (setId: string) => {
    if (!editingSetName.trim()) return;
    storageUtils.updateSet(setId, { name: editingSetName.trim() });
    refreshData();
    setEditingSetId(null);
    setEditingSetName('');
  };

  const getOrderedRacks = (set: RackSet): Rack[] => {
    return set.rackIds
      .map((rackId) => racksById[rackId])
      .filter(Boolean);
  };

  const getOrderedCells = (rack: Rack): Cell[] => {
    if (rack.cells.length === 0) {
      return cells.filter((cell) => cell.rackId === rack.id);
    }
    return rack.cells.map((cellId) => cellsById[cellId]).filter(Boolean);
  };

  const handleRackDrop = (setId: string, rackId: string, targetRackId: string) => {
    if (rackId === targetRackId) return;
    const set = sets.find((s) => s.id === setId);
    if (!set) return;
    const fromIndex = set.rackIds.indexOf(rackId);
    const toIndex = set.rackIds.indexOf(targetRackId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = moveItem(set.rackIds, fromIndex, toIndex);
    storageUtils.reorderRacksInSet(setId, next);
    refreshData();
  };

  const handleCellDrop = (rackId: string, cellId: string, targetCellId: string) => {
    if (cellId === targetCellId) return;
    const rack = racksById[rackId];
    if (!rack) return;
    const fromIndex = rack.cells.indexOf(cellId);
    const toIndex = rack.cells.indexOf(targetCellId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = moveItem(rack.cells, fromIndex, toIndex);
    storageUtils.reorderCellsInRack(rackId, next);
    refreshData();
  };

  const selectedCell = selectedCellId ? cellsById[selectedCellId] : undefined;
  const handleOpenCell = (cellId: string) => {
    if (draggingCellId === cellId) return;
    setSelectedCellId(cellId);
    setCellAliasDraft(cellsById[cellId]?.alias || '');
    setCellDialogOpen(true);
  };

  const handleRemoveSelectedCell = () => {
    if (!selectedCell) return;
    setConfirmState({
      open: true,
      title: 'Remove cell?',
      description: 'This will remove the cell and reindex remaining cell numbers.',
      onConfirm: () => {
        if (selectedCell.rackId) {
          storageUtils.removeCellFromRack(selectedCell.rackId, selectedCell.id);
        }
        storageUtils.removeCell(selectedCell.id);
        refreshData();
        setCellDialogOpen(false);
        setConfirmState({ open: false, title: '', onConfirm: () => {} });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading sets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-4xl font-bold text-slate-100 mb-2">My Sets</h1>
            <p className="text-slate-400">Organize racks horizontally and cells vertically</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-slate-800/60 border border-slate-700/60 px-3 py-2">
              <span className="text-xs text-slate-400">Weight unit</span>
              <select
                value={weightUnit}
                onChange={(event) => {
                  const next = event.target.value as WeightUnit;
                  setWeightUnit(next);
                  storageUtils.setWeightUnit(next);
                }}
                className="bg-slate-900/70 text-sm text-slate-100 border border-slate-600 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              >
                <option value="g" className="bg-slate-900 text-slate-100">g</option>
                <option value="kg" className="bg-slate-900 text-slate-100">kg</option>
                <option value="lb" className="bg-slate-900 text-slate-100">lb</option>
              </select>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-slate-800/60 border border-slate-700/60 px-3 py-2">
              <span className="text-xs text-slate-400">Temp unit</span>
              <select
                value={tempUnit}
                onChange={(event) => {
                  const next = event.target.value as TemperatureUnit;
                  setTempUnit(next);
                  storageUtils.setTempUnit(next);
                }}
                className="bg-slate-900/70 text-sm text-slate-100 border border-slate-600 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              >
                <option value="c" className="bg-slate-900 text-slate-100">C</option>
                <option value="f" className="bg-slate-900 text-slate-100">F</option>
              </select>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAddSet(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 font-bold rounded-lg hover:shadow-lg hover:shadow-cyan-500/50 transition-all"
            >
              <Plus className="w-5 h-5" />
              Add Set
            </motion.button>
          </div>
        </motion.div>

        {/* Add Set Form */}
        {showAddSet && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 rounded-lg bg-slate-800/50 border border-cyan-500/30"
          >
            <h3 className="text-xl font-bold text-slate-100 mb-4">Create New Set</h3>
            <div className="flex gap-4 flex-col sm:flex-row">
              <input
                type="text"
                value={newSetName}
                onChange={(e) => setNewSetName(e.target.value)}
                placeholder="Set name (e.g., Unit Location Floor)"
                className="flex-1 px-3 py-2 rounded bg-slate-900 border border-slate-600 text-slate-100 placeholder-slate-500"
                onKeyPress={(e) => e.key === 'Enter' && handleAddSet()}
              />
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAddSet}
                  className="px-4 py-2 bg-green-500/20 text-green-300 rounded border border-green-500/50 hover:bg-green-500/30 transition-colors"
                >
                  Create
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowAddSet(false)}
                  className="px-4 py-2 bg-slate-700/50 text-slate-400 rounded border border-slate-600/50 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Sets List */}
        <div className="space-y-8">
          {sets.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 text-slate-400"
            >
              <p className="mb-4">No sets created yet</p>
              <button
                onClick={() => setShowAddSet(true)}
                className="px-4 py-2 bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/50 hover:bg-cyan-500/30 transition-colors"
              >
                Create Your First Set
              </button>
            </motion.div>
          ) : (
            sets.map((set) => {
              const orderedRacks = getOrderedRacks(set);

              return (
                <motion.div
                  key={set.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/20 p-6"
                >
                  {/* Set Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Layers className="w-5 h-5 text-cyan-400" />
                      {editingSetId === set.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={editingSetName}
                            onChange={(e) => setEditingSetName(e.target.value)}
                            className="px-2 py-1 rounded bg-slate-900 border border-slate-600 text-slate-100"
                          />
                          <button
                            onClick={() => handleRenameSet(set.id)}
                            className="px-2 py-1 text-xs font-bold bg-green-500/20 text-green-300 rounded"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingSetId(null);
                              setEditingSetName('');
                            }}
                            className="px-2 py-1 text-xs font-bold bg-slate-700/50 text-slate-400 rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <h2 className="text-2xl font-bold text-slate-100 truncate">
                            {set.name}
                          </h2>
                          <p className="text-slate-400 text-sm">
                            {orderedRacks.length} rack{orderedRacks.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        onClick={() => {
                          setEditingSetId(set.id);
                          setEditingSetName(set.name);
                        }}
                        className="p-2 rounded text-blue-400 hover:bg-blue-500/10 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        onClick={() => handleAddRack(set.id)}
                        className="flex items-center gap-2 px-3 py-2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      >
                        <Plus className="w-4 h-4" />
                        Add Rack
                      </motion.button>
                    </div>
                  </div>

                  {/* Rack Grid */}
                  {orderedRacks.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                      No racks in this set yet
                    </div>
                  ) : (
                    <div
                      className="flex flex-col gap-4 sm:grid"
                      style={{ gridTemplateColumns: `repeat(${orderedRacks.length}, minmax(220px, 1fr))` }}
                    >
                      {orderedRacks.map((rack) => {
                        const rackCells = getOrderedCells(rack);
                        const capacityPercentage = (rackCells.length / rack.cellLimit) * 100;

                        return (
                          <div
                            key={rack.id}
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.setData('rackId', rack.id);
                              event.dataTransfer.setData('setId', set.id);
                            }}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                              const draggedRackId = event.dataTransfer.getData('rackId');
                              const draggedSetId = event.dataTransfer.getData('setId');
                              if (draggedSetId === set.id) {
                                handleRackDrop(set.id, draggedRackId, rack.id);
                              }
                            }}
                            className="rounded-lg bg-slate-800/70 border border-cyan-500/20 p-4"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <GripVertical className="w-4 h-4 text-slate-500" />
                                <div className="min-w-0">
                                  <h3 className="text-lg font-bold text-slate-100 truncate">
                                    {rack.name}
                                  </h3>
                                  {rack.alias && (
                                    <p className="text-xs text-slate-400 truncate">{rack.alias}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  onClick={() => {
                                    setEditingRackId(rack.id);
                                    setEditingRackAlias(rack.alias || '');
                                    setEditingRackCapacity(String(rack.cellLimit));
                                  }}
                                  className="p-1 rounded text-cyan-300 hover:bg-cyan-500/10 transition-colors"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  onClick={() => handleDeleteRack(rack.id)}
                                  className="p-1 rounded text-red-400 hover:bg-red-500/10 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </motion.button>
                              </div>
                            </div>

                            {editingRackId === rack.id && (
                              <div className="mb-4 flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    value={editingRackAlias}
                                    onChange={(event) => setEditingRackAlias(event.target.value)}
                                    placeholder="Rack alias"
                                    className="flex-1 px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm"
                                  />
                                  <input
                                    type="number"
                                    min="1"
                                    value={editingRackCapacity}
                                    onChange={(event) => setEditingRackCapacity(event.target.value)}
                                    className="w-24 px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm"
                                    aria-label="Rack capacity"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleSaveRackSettings(rack.id)}
                                    className="px-3 py-2 rounded bg-cyan-500/20 text-cyan-200 text-sm"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingRackId(null)}
                                    className="px-3 py-2 rounded bg-slate-800/60 text-slate-300 text-sm"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}

                            <div className="mb-4">
                              <div className="flex justify-between text-xs text-slate-400 mb-2">
                                <span>Capacity</span>
                                <span>{rackCells.length}/{rack.cellLimit}</span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-slate-700/50 overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${capacityPercentage}%` }}
                                  transition={{ duration: 0.6, ease: 'easeOut' }}
                                  className="h-full bg-gradient-to-r from-cyan-500 to-teal-500"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              {rackCells.length === 0 ? (
                                <div className="flex items-center justify-center py-6">
                                  <Link
                                    href="/undiscovered"
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-cyan-500/20 text-cyan-200 text-xs border border-cyan-500/30 hover:border-cyan-500/50 transition-colors"
                                  >
                                    <Plus className="w-3 h-3" />
                                    Add Cell
                                  </Link>
                                </div>
                              ) : (
                                rackCells.map((cell) => {
                                  const lastMolt = lastMoltByCellId[cell.id]?.timestamp || cell.lastMolt;

                                  return (
                                    <div
                                      key={cell.id}
                                      id={cell.id}
                                      draggable
                                      onDragStart={(event) => {
                                        setDraggingCellId(cell.id);
                                        event.dataTransfer.setData('cellId', cell.id);
                                        event.dataTransfer.setData('rackId', rack.id);
                                      }}
                                      onDragEnd={() => setDraggingCellId(null)}
                                      onDragOver={(event) => event.preventDefault()}
                                      onDrop={(event) => {
                                        const draggedCellId = event.dataTransfer.getData('cellId');
                                        const draggedRackId = event.dataTransfer.getData('rackId');
                                        if (draggedRackId === rack.id) {
                                          handleCellDrop(rack.id, draggedCellId, cell.id);
                                        }
                                      }}
                                      onClick={() => handleOpenCell(cell.id)}
                                      className="flex items-center gap-3 p-2 rounded bg-slate-700/30 hover:bg-slate-700/50 transition-colors"
                                    >
                                      <Grid className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm text-slate-200 font-medium truncate">
                                          Cell {cell.cellNumber}
                                        </p>
                                        {cell.alias && (
                                          <p className="text-[11px] text-slate-400 truncate">{cell.alias}</p>
                                        )}
                                        <p className="text-[11px] text-slate-400 truncate">
                                          {cell.macAddress}
                                        </p>
                                        <p className="text-[11px] text-cyan-300">
                                          Last molt: {lastMolt ? new Date(lastMolt).toLocaleDateString() : 'None'}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <div
                                          className={`w-2 h-2 rounded-full ${
                                            cell.ledStatus === 'on'
                                              ? 'bg-green-400'
                                              : cell.ledStatus === 'blinking'
                                              ? 'bg-yellow-400'
                                              : 'bg-gray-400'
                                          }`}
                                        />
                                        {lastMolt && cell.ledStatus === 'on' && (
                                          <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded">
                                            NOT CHECKED YET
                                          </span>
                                        )}
                                        <span className={`text-xs font-bold ${
                                          cell.status === 'error' ? 'text-red-400' : 'text-green-400'
                                        }`}>
                                          {cell.status}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      <Dialog open={cellDialogOpen} onOpenChange={setCellDialogOpen}>
        <DialogContent className="bg-slate-900 border border-cyan-500/30 text-slate-100 max-w-2xl">
          {selectedCell ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-slate-100">
                  Cell {selectedCell.cellNumber}
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  {selectedCell.macAddress}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-slate-400">Cell Alias</label>
                <div className="flex items-center gap-2">
                  <input
                    value={cellAliasDraft}
                    onChange={(event) => setCellAliasDraft(event.target.value)}
                    placeholder="e.g. Blue Crabs Group"
                    className="flex-1 px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm"
                  />
                  <button
                    onClick={() => {
                      storageUtils.updateCell(selectedCell.id, { alias: cellAliasDraft.trim() || undefined });
                      refreshData();
                    }}
                    className="px-3 py-2 rounded bg-cyan-500/20 text-cyan-200 text-sm"
                  >
                    Save
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-700/60">
                  <p className="text-xs text-slate-400">Status</p>
                  <p className="text-lg font-semibold text-slate-100 capitalize">{selectedCell.status}</p>
                  <p className="text-xs text-slate-400 mt-2">LED</p>
                  {selectedCell.ledStatus === 'on' ? (
                    <button
                      onClick={() => {
                        sendLedCommand(selectedCell.macAddress, 'off');
                        storageUtils.updateCell(selectedCell.id, { ledStatus: 'off' });
                        refreshData();
                      }}
                      className="inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200"
                    >
                      Turn LED Off
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-sm text-slate-400">
                      LED Off
                    </span>
                  )}
                </div>
                <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-700/60">
                  <p className="text-xs text-slate-400">Last Molt</p>
                  <p className="text-lg font-semibold text-slate-100">
                    {selectedCell.lastMolt ? new Date(selectedCell.lastMolt).toLocaleDateString() : 'None'}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">Next Estimate</p>
                  <p className="text-sm text-slate-300">
                    {selectedCell.nextMoltEstimate ? new Date(selectedCell.nextMoltEstimate).toLocaleDateString() : 'Not available'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                {[
                  { label: 'Weight', value: formatWeight(selectedCell.pressure, weightUnit) },
                  { label: 'Moisture', value: `${selectedCell.moisture.toFixed(1)}%` },
                  { label: 'Temperature', value: formatTemperature(selectedCell.temperature, tempUnit) },
                  { label: 'Humidity', value: `${selectedCell.humidity.toFixed(1)}%` },
                ].map((metric) => (
                  <div key={metric.label} className="p-3 rounded bg-slate-800/60 border border-slate-700/60">
                    <p className="text-xs text-slate-400">{metric.label}</p>
                    <p className="text-sm font-semibold text-slate-100">{metric.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <Link
                  href={`/cell/${selectedCell.id}/history`}
                  className="text-sm text-cyan-300 hover:text-cyan-200"
                >
                  See details →
                </Link>
                <button
                  onClick={handleRemoveSelectedCell}
                  className="inline-flex items-center gap-2 text-sm text-red-300 hover:text-red-200"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove Cell
                </button>
              </div>

              <DialogFooter>
                <button
                  onClick={() => setCellDialogOpen(false)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
                >
                  <X className="w-4 h-4" />
                  Close
                </button>
              </DialogFooter>
            </>
          ) : (
            <div className="text-slate-400">No cell selected.</div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState({ open: false, title: '', onConfirm: () => {} })}
      />
    </div>
  );
}
