'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Clock, Settings2, TrendingUp } from 'lucide-react';
import { useMoltSense } from '@/lib/hooks/useMoltSense';
import { acknowledgeMolt } from '@/lib/esp32';

const formatHour = (date: Date) =>
  date.toLocaleTimeString([], { hour: 'numeric', hour12: true });

export function CellHistoryPage() {
  const params = useParams();
  const cellId = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const { cells, moltEvents, acknowledgeMoltEvent, isLoading } = useMoltSense();

  const cell = useMemo(
    () => cells.find((item) => item.id === cellId),
    [cells, cellId]
  );

  const cellEvents = useMemo(() => {
    if (!cellId) return [];
    return moltEvents
      .filter((event) => event.cellId === cellId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [moltEvents, cellId]);

  const avgIntervalDays = useMemo(() => {
    if (cellEvents.length < 2) return null;
    const intervals = cellEvents
      .slice(0, cellEvents.length - 1)
      .map((event, index) =>
        Math.abs(
          new Date(event.timestamp).getTime() -
            new Date(cellEvents[index + 1].timestamp).getTime()
        )
      );
    const avgMs = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    return Math.round(avgMs / (1000 * 60 * 60 * 24));
  }, [cellEvents]);

  const mostCommonHour = useMemo(() => {
    if (cellEvents.length === 0) return null;
    const buckets = new Map<number, number>();
    cellEvents.forEach((event) => {
      const hour = new Date(event.timestamp).getHours();
      buckets.set(hour, (buckets.get(hour) || 0) + 1);
    });
    let topHour = 0;
    let topCount = 0;
    buckets.forEach((count, hour) => {
      if (count > topCount) {
        topCount = count;
        topHour = hour;
      }
    });
    const hourDate = new Date();
    hourDate.setHours(topHour, 0, 0, 0);
    return formatHour(hourDate);
  }, [cellEvents]);

  const feedingPrediction = useMemo(() => {
    if (!cell?.lastMolt) return 'Not enough data';
    const next = new Date(cell.lastMolt);
    const interval = avgIntervalDays ?? 1;
    next.setDate(next.getDate() + interval);
    next.setHours(7, 0, 0, 0);
    return next.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }, [cell?.lastMolt, avgIntervalDays]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading cell history...</p>
        </div>
      </div>
    );
  }

  if (!cell) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <Link href="/dashboard" className="text-cyan-300 flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </Link>
          <div className="mt-6 p-6 rounded-lg bg-slate-800/50 border border-cyan-500/20 text-slate-300">
            Cell not found.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/my-racks" className="text-cyan-300 flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to My Sets
          </Link>
          <Link
            href={`/cell/${cell.id}/config`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 text-sm"
          >
            <Settings2 className="w-4 h-4" />
            Configure Cell
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <h1 className="text-3xl font-bold text-slate-100">Cell {cell.cellNumber} History</h1>
          <p className="text-slate-400 mt-2">{cell.macAddress}</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="p-6 rounded-lg bg-slate-800/60 border border-cyan-500/20">
            <div className="flex items-center gap-2 text-cyan-300">
              <Calendar className="w-4 h-4" />
              <p className="text-sm font-semibold">Average molt interval</p>
            </div>
            <p className="text-2xl font-bold text-slate-100 mt-3">
              {avgIntervalDays ? `${avgIntervalDays} days` : 'Not enough data'}
            </p>
          </div>

          <div className="p-6 rounded-lg bg-slate-800/60 border border-cyan-500/20">
            <div className="flex items-center gap-2 text-cyan-300">
              <Clock className="w-4 h-4" />
              <p className="text-sm font-semibold">Most molts occur</p>
            </div>
            <p className="text-2xl font-bold text-slate-100 mt-3">
              {mostCommonHour ? `${mostCommonHour}` : 'No data yet'}
            </p>
          </div>

          <div className="p-6 rounded-lg bg-slate-800/60 border border-cyan-500/20">
            <div className="flex items-center gap-2 text-cyan-300">
              <TrendingUp className="w-4 h-4" />
              <p className="text-sm font-semibold">Feeding cycle prediction</p>
            </div>
            <p className="text-2xl font-bold text-slate-100 mt-3">{feedingPrediction}</p>
          </div>
        </div>

        <div className="mt-10">
          <h2 className="text-2xl font-bold text-slate-100 mb-4">Molt History</h2>
          {cellEvents.length === 0 ? (
            <div className="p-6 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400">
              No molt events recorded for this cell yet.
            </div>
          ) : (
            <div className="space-y-3">
              {cellEvents.map((event) => (
                <div
                  key={event.id}
                  className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm text-slate-200">
                      {new Date(event.timestamp).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400">Duration: {event.duration}h</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold ${event.acknowledged ? 'text-green-400' : 'text-yellow-300'}`}>
                      {event.acknowledged ? 'Acknowledged' : 'Pending'}
                    </span>
                    {!event.acknowledged && cell && (
                      <button
                        onClick={async () => {
                          acknowledgeMoltEvent(event.id);
                          await acknowledgeMolt(cell.macAddress, event.id);
                        }}
                        className="text-xs px-2 py-1 rounded bg-cyan-500/20 text-cyan-200 border border-cyan-500/40"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
