'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Cell, MoltEvent } from '@/lib/localStorage';
import { formatTemperature, formatWeight, TemperatureUnit, WeightUnit } from '@/lib/utils';
import { Gauge, Droplets, Thermometer, Wind, Trash2, AlertCircle } from 'lucide-react';
import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';

interface CellCardProps {
  cell: Cell;
  moltEvents?: MoltEvent[];
  weightUnit?: WeightUnit;
  tempUnit?: TemperatureUnit;
  onToggleLed?: () => void;
  onRemove?: (id: string) => void;
}

export function CellCard({
  cell,
  moltEvents = [],
  weightUnit = 'g',
  tempUnit = 'c',
  onToggleLed,
  onRemove,
}: CellCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const ledRef = useRef<HTMLDivElement>(null);
  const [showAlert, setShowAlert] = useState(false);

  // LED animation
  useEffect(() => {
    if (!ledRef.current) return;

    if (cell.ledStatus === 'blinking') {
      gsap.to(ledRef.current, {
        opacity: 0.3,
        duration: 0.5,
        yoyo: true,
        repeat: -1,
      });
    } else if (cell.ledStatus === 'on') {
      gsap.to(ledRef.current, {
        opacity: 1,
        boxShadow: '0 0 20px rgba(34, 211, 238, 0.8)',
        duration: 0.3,
      });
    } else {
      gsap.to(ledRef.current, {
        opacity: 0.2,
        boxShadow: 'none',
        duration: 0.3,
      });
    }
  }, [cell.ledStatus]);

  // Moisture alert animation
  useEffect(() => {
    if (cell.moisture > 75) {
      setShowAlert(true);
      const timer = setTimeout(() => setShowAlert(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [cell.moisture]);

  const statusColors = {
    active: 'text-green-400 bg-green-500/10',
    inactive: 'text-yellow-400 bg-yellow-500/10',
    error: 'text-red-400 bg-red-500/10',
  };

  const cellEvents = moltEvents
    .filter((event) => event.cellId === cell.id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const lastMoltTime = cellEvents[0]?.timestamp || cell.lastMolt;
  const avgIntervalDays = (() => {
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
  })();
  const predictedFeeding = (() => {
    if (!lastMoltTime) return 'Not enough data';
    const next = new Date(lastMoltTime);
    next.setDate(next.getDate() + 1);
    next.setHours(7, 0, 0, 0);
    return next.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  })();

  return (
    <motion.div
      ref={cardRef}
      whileHover={{ y: -4 }}
      className="h-full"
    >
      <Link href={`/cell/${cell.id}/history`}>
        <div className="h-full p-6 rounded-lg bg-gradient-to-br from-slate-800/50 to-slate-700/50 border border-cyan-500/20 hover:border-cyan-500/50 transition-all cursor-pointer group">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="min-w-0">
              <h3 className="text-xl font-bold text-slate-100 mb-1 truncate">
                Cell {cell.cellNumber}
              </h3>
              {cell.alias && (
                <p className="text-xs text-slate-400 truncate">{cell.alias}</p>
              )}
              <p className="text-xs text-slate-500 font-mono truncate">
                {cell.macAddress}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* LED Status Indicator */}
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  onToggleLed?.();
                }}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-800/60"
              >
                <div
                  ref={ledRef}
                  className={`w-3 h-3 rounded-full border-2 border-cyan-400 ${
                    cell.ledStatus === 'on'
                      ? 'bg-green-400'
                      : cell.ledStatus === 'blinking'
                      ? 'bg-yellow-400'
                      : 'bg-gray-400'
                  }`}
                />
                <span className="text-xs text-slate-300">
                  LED {cell.ledStatus === 'on' ? 'ON' : cell.ledStatus === 'blinking' ? 'BLINKING' : 'OFF'}
                </span>
              </button>
              {/* Status Badge */}
              <span
                className={`px-2 py-1 rounded text-xs font-bold ${
                  statusColors[cell.status]
                }`}
              >
                {cell.status}
              </span>
            </div>
          </div>

          {/* Alert Banner */}
          {showAlert && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="mb-4 p-3 rounded bg-amber-500/20 border border-amber-500/50 text-amber-300 text-sm flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4" />
              High moisture detected
            </motion.div>
          )}

          {/* Sensor Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              {
                icon: <Gauge className="w-4 h-4" />,
                label: 'Weight',
                value: formatWeight(cell.pressure, weightUnit),
                unit: weightUnit,
              },
              {
                icon: <Droplets className="w-4 h-4" />,
                label: 'Moisture',
                value: `${cell.moisture.toFixed(1)}%`,
                unit: '%',
              },
              {
                icon: <Thermometer className="w-4 h-4" />,
                label: 'Temp',
                value: formatTemperature(cell.temperature, tempUnit),
                unit: tempUnit,
              },
            ].map((sensor, idx) => (
              <div
                key={idx}
                className="p-3 rounded bg-slate-900/50 border border-slate-700/50"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-cyan-400">{sensor.icon}</span>
                  <span className="text-xs text-slate-400">{sensor.label}</span>
                </div>
                <p className="font-bold text-slate-100">{sensor.value}</p>
              </div>
            ))}
          </div>

          {/* Humidity */}
          <div className="mb-4 p-3 rounded bg-slate-900/50 border border-slate-700/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-slate-400">Humidity</span>
            </div>
            <p className="font-bold text-slate-100">{cell.humidity.toFixed(1)}%</p>
          </div>

          {/* Farmer Metrics */}
          <div className="mb-4 p-3 rounded bg-slate-900/50 border border-slate-700/50 space-y-2">
            <p className="text-xs text-slate-400">Molting detected at</p>
            <p className="text-sm font-bold text-teal-300">
              {lastMoltTime ? new Date(lastMoltTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'No molt detected'}
            </p>
            <p className="text-xs text-slate-400">Average molt interval</p>
            <p className="text-sm text-slate-200">
              {avgIntervalDays ? `${avgIntervalDays} days` : 'Not enough data'}
            </p>
            <p className="text-xs text-slate-400">Feeding cycle prediction</p>
            <p className="text-sm text-slate-200">{predictedFeeding}</p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
            <button
              onClick={(e) => {
                e.preventDefault();
                if (onRemove) {
                  onRemove(cell.id);
                }
              }}
              className="flex items-center gap-1 px-2 py-1 rounded text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Remove
            </button>
            <span className="text-xs text-slate-500">
              View History →
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
