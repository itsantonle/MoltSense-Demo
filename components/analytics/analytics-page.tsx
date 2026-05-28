'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { useMoltSense } from '@/lib/hooks/useMoltSense';
import { BarChart3, TrendingUp, Calendar, FileText } from 'lucide-react';

export function AnalyticsPage() {
  const { cells, moltEvents, isLoading } = useMoltSense();
  const [reportRange, setReportRange] = useState<'7d' | '30d' | '90d'>('30d');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  // Mock analytics data
  const avgMoisture = cells.length > 0
    ? (cells.reduce((sum, c) => sum + c.moisture, 0) / cells.length).toFixed(1)
    : 0;

  const avgTemperature = cells.length > 0
    ? (cells.reduce((sum, c) => sum + c.temperature, 0) / cells.length).toFixed(1)
    : 0;

  const moltsThisWeek = moltEvents.filter(
    (e) =>
      new Date(e.timestamp) >
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ).length;

  const avgMoltsPerCell = cells.length > 0
    ? (moltsThisWeek / cells.length).toFixed(1)
    : 0;

  const mockReport = {
    totalMolts: reportRange === '7d' ? 12 : reportRange === '30d' ? 48 : 132,
    avgInterval: reportRange === '7d' ? 11 : reportRange === '30d' ? 12 : 13,
    peakWindow: reportRange === '7d' ? '7:00 PM' : reportRange === '30d' ? '8:00 PM' : '6:00 PM',
  };

  const frequency = cells.map((cell) => ({
    id: cell.id,
    label: `Cell ${cell.cellNumber}`,
    count: moltEvents.filter((event) => event.cellId === cell.id).length,
  }));
  const sortedFrequency = [...frequency].sort((a, b) => b.count - a.count);
  const mostFrequent = sortedFrequency[0];
  const leastFrequent = sortedFrequency[sortedFrequency.length - 1];

  const reportRows = Array.from({ length: 5 }).map((_, index) => ({
    date: new Date(Date.now() - index * 86400000).toLocaleDateString(),
    molts: Math.max(1, 4 - index),
    peak: index % 2 === 0 ? '7:00 PM' : '8:00 PM',
    notes: 'Mock report row',
  }));

  const handleDownloadReport = () => {
    const header = ['Date', 'Molts', 'Peak Window', 'Notes'];
    const rows = reportRows.map((row) => [row.date, row.molts, row.peak, row.notes]);
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `molt-report-${reportRange}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
              Farm Analytics
            </h1>
            <p className="text-slate-400">
              Predictive insights and farm-level performance metrics
            </p>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[
            {
              label: 'Avg Moisture',
              value: `${avgMoisture}%`,
              icon: <TrendingUp className="w-6 h-6" />,
              color: 'text-blue-400',
            },
            {
              label: 'Avg Temperature',
              value: `${avgTemperature}°C`,
              icon: <TrendingUp className="w-6 h-6" />,
              color: 'text-red-400',
            },
            {
              label: 'Molts This Week',
              value: moltsThisWeek,
              icon: <Calendar className="w-6 h-6" />,
              color: 'text-teal-400',
            },
            {
              label: 'Avg Molts/Cell',
              value: avgMoltsPerCell,
              icon: <BarChart3 className="w-6 h-6" />,
              color: 'text-cyan-400',
            },
          ].map((kpi, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -4 }}
              className="p-6 rounded-lg bg-gradient-to-br from-slate-800/50 to-slate-700/50 border border-cyan-500/20 hover:border-cyan-500/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-slate-400 text-sm font-medium">{kpi.label}</p>
                <div className={`${kpi.color}`}>{kpi.icon}</div>
              </div>
              <p className="text-3xl font-bold text-slate-100">{kpi.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Insights Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 rounded-lg bg-gradient-to-br from-slate-800/50 to-slate-700/50 border border-cyan-500/20"
        >
          <h2 className="text-2xl font-bold text-slate-100 mb-6">
            Predictive Insights
          </h2>

          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/50">
              <h3 className="font-bold text-slate-100 mb-2">
                Optimal Feeding Cycles
              </h3>
              <p className="text-slate-400 text-sm">
                Based on molt frequency analysis, recommend feeding during early
                morning hours (5-7 AM) for maximum consumption and molt recovery.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/50">
              <h3 className="font-bold text-slate-100 mb-2">
                Molt Frequency Trends
              </h3>
              <p className="text-slate-400 text-sm">
                Current molt cycle averages {avgMoltsPerCell} molts per cell per week.
                Moisture levels are optimal at {avgMoisture}% avg humidity.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/50">
              <h3 className="font-bold text-slate-100 mb-2">
                Expected Harvest Timing
              </h3>
              <p className="text-slate-400 text-sm">
                Soft-shell crabs will be ready for market in approximately 4-6 days
                based on current molt patterns and environmental conditions.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Molt Report */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-10 p-8 rounded-lg bg-gradient-to-br from-slate-800/50 to-slate-700/50 border border-cyan-500/20"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-300" />
              <h2 className="text-2xl font-bold text-slate-100">Molt Report</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg bg-slate-900/50 border border-slate-700/50 px-3 py-2">
                <span className="text-xs text-slate-400">Time period</span>
                <select
                  value={reportRange}
                  onChange={(event) => setReportRange(event.target.value as '7d' | '30d' | '90d')}
                  className="bg-transparent text-sm text-slate-100"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                </select>
              </div>
              <button
                onClick={handleDownloadReport}
                className="px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 text-sm"
              >
                Save CSV
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total molts', value: mockReport.totalMolts },
              { label: 'Avg molt interval', value: `${mockReport.avgInterval} days` },
              { label: 'Peak molt window', value: mockReport.peakWindow },
            ].map((item) => (
              <div key={item.label} className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/50">
                <p className="text-xs text-slate-400">{item.label}</p>
                <p className="text-lg font-semibold text-slate-100 mt-2">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-slate-700/50 overflow-hidden">
            <div className="grid grid-cols-4 gap-2 bg-slate-900/70 text-xs text-slate-400 px-4 py-2">
              <span>Date</span>
              <span>Molts</span>
              <span>Peak window</span>
              <span>Notes</span>
            </div>
            {reportRows.map((row, index) => (
              <div key={index} className="grid grid-cols-4 gap-2 px-4 py-3 text-sm text-slate-200 border-t border-slate-800">
                <span>{row.date}</span>
                <span>{row.molts}</span>
                <span>{row.peak}</span>
                <span className="text-slate-400">{row.notes}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-10 p-8 rounded-lg bg-gradient-to-br from-slate-800/50 to-slate-700/50 border border-cyan-500/20"
        >
          <h2 className="text-2xl font-bold text-slate-100 mb-6">
            Cell Molt Frequency
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/50">
              <p className="text-xs text-slate-400">Most frequent</p>
              <p className="text-lg font-semibold text-slate-100 mt-2">
                {mostFrequent ? mostFrequent.label : 'No data'}
              </p>
              <p className="text-xs text-slate-400">{mostFrequent ? `${mostFrequent.count} molts` : '—'}</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/50">
              <p className="text-xs text-slate-400">Least frequent</p>
              <p className="text-lg font-semibold text-slate-100 mt-2">
                {leastFrequent ? leastFrequent.label : 'No data'}
              </p>
              <p className="text-xs text-slate-400">{leastFrequent ? `${leastFrequent.count} molts` : '—'}</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/50">
              <p className="text-xs text-slate-400">No molts recorded</p>
              <p className="text-lg font-semibold text-slate-100 mt-2">
                {sortedFrequency.filter((item) => item.count === 0).length}
              </p>
              <p className="text-xs text-slate-400">cells</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
