'use client';

import { motion } from 'framer-motion';
import { useMoltSense } from '@/lib/hooks/useMoltSense';
import { storageUtils, Rack } from '@/lib/localStorage';
import { Calendar, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export function MoltHistoryPage() {
  const { moltEvents, cells, sets, isLoading } = useMoltSense();
  const [racks, setRacks] = useState<Rack[]>([]);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'date' | 'cell' | 'rack' | 'set'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    setRacks(storageUtils.getRacks());
  }, [cells.length]);

  const normalizeMacAddress = (value: string) => value.trim().toLowerCase();

  const rows = useMemo(() => {
    return moltEvents.map((event) => {
      const cell = cells.find((item) => {
        if (item.id === event.cellId) return true;
        if (!event.macAddress) return false;
        return normalizeMacAddress(item.macAddress) === normalizeMacAddress(event.macAddress);
      });
      const rack = racks.find((item) => item.id === cell?.rackId);
      const set = sets.find((item) => item.id === rack?.setId);
      return {
        event,
        cell,
        rack,
        set,
      };
    });
  }, [moltEvents, cells, racks, sets]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(({ event, cell, rack, set }) => {
      return (
        `${cell?.cellNumber ?? ''}`.includes(query) ||
        cell?.macAddress?.toLowerCase().includes(query) ||
        event.macAddress?.toLowerCase().includes(query) ||
        rack?.name?.toLowerCase().includes(query) ||
        set?.name?.toLowerCase().includes(query)
      );
    });
  }, [rows, search]);

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      if (sortKey === 'date') {
        const timeA = new Date(a.event.timestamp).getTime();
        const timeB = new Date(b.event.timestamp).getTime();
        return sortDir === 'asc' ? timeA - timeB : timeB - timeA;
      }
      if (sortKey === 'cell') {
        const valueA = a.cell?.cellNumber ?? 0;
        const valueB = b.cell?.cellNumber ?? 0;
        return sortDir === 'asc' ? valueA - valueB : valueB - valueA;
      }
      if (sortKey === 'rack') {
        const valueA = a.rack?.name ?? '';
        const valueB = b.rack?.name ?? '';
        return sortDir === 'asc'
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }
      const valueA = a.set?.name ?? '';
      const valueB = b.set?.name ?? '';
      return sortDir === 'asc'
        ? valueA.localeCompare(valueB)
        : valueB.localeCompare(valueA);
    });
    return sorted;
  }, [filteredRows, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const pagedRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);

  // Calculate stats
  const stats = {
    totalMolts: moltEvents.length,
    thisWeek: moltEvents.filter((e) => {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return new Date(e.timestamp).getTime() > weekAgo;
    }).length,
    acknowledged: moltEvents.filter((e) => e.acknowledged).length,
    avgDuration: moltEvents.length > 0 
      ? (moltEvents.reduce((sum, e) => sum + e.duration, 0) / moltEvents.length).toFixed(1)
      : 0,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading molt history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-cyan-500/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-8 h-8 text-cyan-400" />
              <h1 className="text-4xl font-bold text-slate-100">
                Molt History
              </h1>
            </div>
            <p className="text-slate-400">
              View all recorded molt events across your farm
            </p>
          </motion.div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="border-b border-cyan-500/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              {
                label: 'Total Molts',
                value: stats.totalMolts,
                icon: '🦀',
                color: 'from-cyan-500/10 to-teal-500/10 border-cyan-500/30',
              },
              {
                label: 'This Week',
                value: stats.thisWeek,
                icon: '📅',
                color: 'from-green-500/10 to-emerald-500/10 border-green-500/30',
              },
              {
                label: 'Acknowledged',
                value: `${stats.acknowledged}/${stats.totalMolts}`,
                icon: '✓',
                color: 'from-blue-500/10 to-indigo-500/10 border-blue-500/30',
              },
              {
                label: 'Avg Duration',
                value: `${stats.avgDuration}h`,
                icon: '⏱️',
                color: 'from-purple-500/10 to-pink-500/10 border-purple-500/30',
              },
            ].map((stat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`p-4 rounded-lg bg-gradient-to-br ${stat.color} border`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-xs mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold text-slate-100">{stat.value}</p>
                  </div>
                  <div className="text-3xl">{stat.icon}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="border-b border-cyan-500/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-2 rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search cell, rack, or set"
              className="bg-transparent text-sm text-slate-100 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as typeof sortKey)}
              className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-100"
            >
              <option value="date">Sort by date</option>
              <option value="cell">Sort by cell</option>
              <option value="rack">Sort by rack</option>
              <option value="set">Sort by set</option>
            </select>
            <button
              onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-sm text-slate-300"
            >
              {sortDir === 'asc' ? 'Asc' : 'Desc'}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {pagedRows.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Calendar className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">No molt events recorded yet</p>
          </motion.div>
        ) : (
          <div className="rounded-lg border border-cyan-500/20 overflow-hidden">
            <div className="hidden sm:grid grid-cols-6 gap-2 bg-slate-900/70 text-xs text-slate-400 px-4 py-3">
              <span>Date</span>
              <span>Cell</span>
              <span>Rack</span>
              <span>Set</span>
              <span>Duration</span>
              <span>Status</span>
            </div>
            {pagedRows.map(({ event, cell, rack, set }, idx) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
                className="flex flex-col gap-2 px-4 py-3 text-xs sm:text-sm text-slate-200 border-t border-slate-800 sm:grid sm:grid-cols-6 sm:gap-2"
              >
                <div className="flex items-center justify-between sm:block">
                  <span className="text-[10px] text-slate-500 sm:hidden">Date</span>
                  <div className="text-right sm:text-left">
                    <p className="text-slate-100">{new Date(event.timestamp).toLocaleDateString()}</p>
                    <p className="text-[10px] sm:text-xs text-slate-400">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:block">
                  <span className="text-[10px] text-slate-500 sm:hidden">Cell</span>
                  <span>
                    {cell
                      ? `Cell ${cell.cellNumber}`
                      : event.macAddress
                      ? event.macAddress
                      : event.cellId}
                  </span>
                </div>
                <div className="flex items-center justify-between sm:block">
                  <span className="text-[10px] text-slate-500 sm:hidden">Rack</span>
                  <span>{rack?.name || 'Unassigned'}</span>
                </div>
                <div className="flex items-center justify-between sm:block">
                  <span className="text-[10px] text-slate-500 sm:hidden">Set</span>
                  <span>{set?.name || 'Unassigned'}</span>
                </div>
                <div className="flex items-center justify-between sm:block">
                  <span className="text-[10px] text-slate-500 sm:hidden">Duration</span>
                  <span>{event.duration}h</span>
                </div>
                <div className="flex items-center justify-between sm:block">
                  <span className="text-[10px] text-slate-500 sm:hidden">Status</span>
                  <span className={`text-xs font-semibold ${event.acknowledged ? 'text-green-400' : 'text-yellow-300'}`}>
                    {event.acknowledged ? 'Acknowledged' : 'Pending'}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {sortedRows.length > 0 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded bg-slate-800/50 border border-slate-700/50 text-xs text-slate-300 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded bg-slate-800/50 border border-slate-700/50 text-xs text-slate-300 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
