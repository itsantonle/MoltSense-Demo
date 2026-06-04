'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useMoltSense } from '@/lib/hooks/useMoltSense';
import { Cell, Rack, RackSet, MoltEvent } from '@/lib/localStorage';
import { storageUtils } from '@/lib/localStorage';
import Link from 'next/link';
import { Plus, AlertCircle, Info } from 'lucide-react';
import { CellCard } from './cell-card';
import { sendLedCommand, unregisterEsp32Device } from '@/lib/esp32';
import { SortOption } from './sort-dropdown';
import { TemperatureUnit, WeightUnit } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const normalizeMacAddress = (value: string) => value.trim().toLowerCase();

export function DashboardPage() {
  const { cells, isLoading, updateCell, removeCell } = useMoltSense();
  const [racks, setRacks] = useState<Rack[]>([]);
  const [sets, setSets] = useState<RackSet[]>([]);
  const [moltEvents, setMoltEvents] = useState<MoltEvent[]>([]);
  const [recentCells, setRecentCells] = useState<Cell[]>([]);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('g');
  const [tempUnit, setTempUnit] = useState<TemperatureUnit>('c');
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  // Cells are added via discovery or backend registration

  // Update recent cells and racks
  useEffect(() => {
    const racksList = storageUtils.getRacks();
    const setsList = storageUtils.getSets();
    const recent = storageUtils.getRecentMoltCells(5);
    const events = storageUtils.getMoltEvents();
    setRacks(racksList);
    setSets(setsList);
    setRecentCells(recent);
    setMoltEvents(events);
    setWeightUnit(storageUtils.getWeightUnit());
    setTempUnit(storageUtils.getTempUnit());
  }, [cells]);
  const handleToggleLed = (cell: Cell) => {
    const nextStatus = cell.ledStatus === 'on' ? 'off' : 'on';
    sendLedCommand(cell.macAddress, nextStatus);
    updateCell(cell.id, { ledStatus: nextStatus });
  };

  const handleRemoveCell = async (cell: Cell) => {
    const confirmed = window.confirm(
      `Remove Cell ${cell.cellNumber}? This will delete its local history, alerts, and settings, unregister the device so it can be rediscovered later, and clear it from the dashboard.`
    );
    if (!confirmed) return;

    await unregisterEsp32Device(cell.macAddress);
    removeCell(cell.id);
  };

  const getRackCells = (rackId: string): Cell[] => {
    return cells.filter((c) => c.rackId === rackId);
  };

  const getOrderedCells = (rack: Rack): Cell[] => {
    if (rack.cells.length > 0) {
      return rack.cells
        .map((cellId) => cells.find((cell) => cell.id === cellId))
        .filter(Boolean) as Cell[];
    }
    return getRackCells(rack.id);
  };

  const lastMoltByCellId = moltEvents.reduce<Record<string, MoltEvent>>(
    (acc, event) => {
      const resolvedCell = cells.find((cell) => {
        if (cell.id === event.cellId) return true;
        if (!event.macAddress) return false;
        return normalizeMacAddress(cell.macAddress) === normalizeMacAddress(event.macAddress);
      });
      const targetCellId = resolvedCell?.id ?? event.cellId;
      const existing = acc[targetCellId];
      if (!existing || new Date(event.timestamp) > new Date(existing.timestamp)) {
        acc[targetCellId] = event;
      }
      return acc;
    },
    {}
  );

  const topSets = sets.slice(0, 3);

  const sortCells = (cellsToSort: Cell[]): Cell[] => {
    const sorted = [...cellsToSort];
    switch (sortBy) {
      case 'status':
        return sorted.sort((a, b) => {
          const statusOrder = { error: 0, inactive: 1, active: 2 };
          return statusOrder[b.status] - statusOrder[a.status];
        });
      case 'name':
        return sorted.sort((a, b) => a.cellNumber - b.cellNumber);
      case 'hub':
        return sorted.sort((a, b) => a.hubId.localeCompare(b.hubId));
      case 'recent':
      default:
        return sorted.sort((a, b) => {
          const timeA = new Date(a.lastMolt || 0).getTime();
          const timeB = new Date(b.lastMolt || 0).getTime();
          return timeB - timeA;
        });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading dashboard...</p>
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
          className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 className="text-4xl font-bold text-slate-100 mb-2">Dashboard</h1>
            <p className="text-slate-400">Monitor and manage your crab cells</p>
          </div>
          <Link
            href="/my-cells"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 font-bold hover:shadow-lg hover:shadow-cyan-500/50 transition-all"
          >
            <Plus className="w-5 h-5" />
            Add Cell
          </Link>
        </motion.div>

        {/* Overview */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-12"
        >
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-2xl font-bold text-slate-100">Visualized Grid</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  aria-label="Visualized grid info"
                  className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-800/60 border border-cyan-500/30 text-cyan-300 hover:text-cyan-200"
                >
                  <Info className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent sideOffset={8} className="bg-slate-900 text-slate-100 border border-cyan-500/20">
                Bird&apos;s-eye map of sets, racks, and cells. Click a cell to jump to it.
              </TooltipContent>
            </Tooltip>
          </div>
          {sets.length === 0 ? (
            <div className="rounded-lg border border-cyan-500/20 bg-slate-800/50 p-6 text-slate-400">
              No sets configured yet.
            </div>
          ) : (
            <div className="space-y-6">
              {sets.map((set) => {
                const setRacks = set.rackIds
                  .map((rackId) => racks.find((rack) => rack.id === rackId))
                  .filter(Boolean) as Rack[];
                const maxCells = Math.max(
                  1,
                  ...setRacks.map((rack) => getOrderedCells(rack).length)
                );

                return (
                  <div
                    key={set.id}
                    className="rounded-lg border border-cyan-500/20 bg-slate-800/50 p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-bold text-slate-100 truncate max-w-[70%]">
                        {set.name}
                      </h3>
                      <Link
                        href="/my-racks"
                        className="text-sm text-cyan-300 hover:text-cyan-200"
                      >
                        Open Set →
                      </Link>
                    </div>
                    <div
                      className="flex flex-col gap-2 sm:grid"
                      style={{ gridTemplateColumns: `repeat(${Math.max(1, setRacks.length)}, minmax(140px, 1fr))` }}
                    >
                      {setRacks.map((rack) => (
                        <div key={rack.id} className="rounded bg-slate-900/50 border border-slate-700/50">
                          <div className="px-3 py-2 text-xs font-semibold text-slate-300 border-b border-slate-700/50 truncate">
                            {rack.name}
                          </div>
                          <div className="p-2 space-y-2">
                            {(() => {
                              const rackCells = getOrderedCells(rack);
                              if (rackCells.length === 0) {
                                return (
                                  <div className="h-10 rounded border border-dashed border-slate-700/50 bg-slate-800/30 flex items-center justify-center text-[10px] text-slate-500">
                                    No cells assigned
                                  </div>
                                );
                              }
                              return Array.from({ length: maxCells }).map((_, index) => {
                                const cell = rackCells[index];
                                if (!cell) {
                                  return (
                                    <div
                                      key={`${rack.id}-empty-${index}`}
                                      className="h-10 rounded border border-dashed border-slate-700/50 bg-slate-800/30"
                                    />
                                  );
                                }
                                const lastMolt = lastMoltByCellId[cell.id]?.timestamp || cell.lastMolt;
                                return (
                                  <Link
                                    key={cell.id}
                                    href={`/my-racks#${cell.id}`}
                                    className="block"
                                  >
                                    <div className="rounded bg-slate-800/70 border border-cyan-500/20 px-3 py-2 hover:border-cyan-500/40 transition-colors">
                                      <div className="flex items-center justify-between text-xs text-slate-300">
                                        <span className="truncate">Cell {cell.cellNumber}</span>
                                        <span className={`text-[10px] ${cell.ledStatus === 'on' ? 'text-green-400' : cell.ledStatus === 'blinking' ? 'text-yellow-400' : 'text-slate-500'}`}>
                                          LED {cell.ledStatus}
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-cyan-300 mt-1">
                                        Last molt: {lastMolt ? new Date(lastMolt).toLocaleDateString() : 'None'}
                                      </div>
                                    </div>
                                  </Link>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Recent Active Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <h2 className="text-2xl font-bold text-slate-100">Recently Active</h2>
            </div>
            <div className="flex items-center gap-2 flex-nowrap">
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
            </div>
          </div>
          {recentCells.length === 0 ? (
            <div className="rounded-lg border border-slate-800/70 bg-slate-900/40 p-6 text-slate-400">
              No recently active cells yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentCells.slice(0, 3).map((cell, idx) => (
                <motion.div
                  key={cell.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <CellCard
                    cell={cell}
                    moltEvents={moltEvents}
                    weightUnit={weightUnit}
                    tempUnit={tempUnit}
                    onToggleLed={() => handleToggleLed(cell)}
                    onRemove={() => {
                      void handleRemoveCell(cell);
                    }}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* My Sets */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-slate-100">My Sets</h2>
            <Link
              href="/my-racks"
              className="text-sm text-cyan-300 hover:text-cyan-200"
            >
              Manage Sets →
            </Link>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
            {topSets.map((set) => {
              const setRacks = set.rackIds
                .map((rackId) => racks.find((rack) => rack.id === rackId))
                .filter(Boolean) as Rack[];

              return (
                <div
                  key={set.id}
                  className="rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/20 p-6 hover:border-cyan-500/40 transition-colors"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-slate-100">{set.name}</h3>
                      <p className="text-xs text-slate-400">{setRacks.length} rack{setRacks.length !== 1 ? 's' : ''}</p>
                    </div>
                    <Link
                      href="/my-racks"
                      className="text-sm text-cyan-300 hover:text-cyan-200"
                    >
                      Open
                    </Link>
                  </div>

                  {setRacks.length === 0 ? (
                    <div className="text-sm text-slate-400">No racks yet</div>
                  ) : (
                    <div className="space-y-2">
                      {setRacks.map((rack) => {
                        const rackCells = sortCells(getOrderedCells(rack));
                        return (
                          <div
                            key={rack.id}
                            className="flex items-center justify-between rounded bg-slate-900/50 border border-slate-700/50 px-3 py-2"
                          >
                            <span className="text-sm text-slate-200">{rack.name}</span>
                            <span className="text-xs text-slate-400">{rackCells.length} cells</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {sets.length > 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center py-4"
            >
              <Link
                href="/my-racks"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 text-cyan-400 font-medium hover:border-cyan-500/50 transition-all"
              >
                See All Sets ({sets.length})
              </Link>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
