'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMoltSense } from '@/lib/hooks/useMoltSense';
import { Bell, AlertCircle, CheckCircle, Droplets, Trash2 } from 'lucide-react';
import gsap from 'gsap';
import { useRef, useEffect } from 'react';

export function AlertsPage() {
  const { alerts, cells, markAlertAsRead, clearAllAlerts, isLoading } =
    useMoltSense();
  const [filter, setFilter] = useState<'all' | 'unread' | 'molt' | 'moisture' | 'error'>('all');
  const bellRef = useRef<HTMLDivElement>(null);

  // Bell animation for new alerts
  useEffect(() => {
    if (!bellRef.current || alerts.length === 0) return;
    const unreadCount = alerts.filter((a) => !a.read).length;
    if (unreadCount > 0) {
      gsap.to(bellRef.current, {
        rotation: -15,
        duration: 0.1,
        yoyo: true,
        repeat: 2,
      });
    }
  }, [alerts]);

  const getCellName = (cellId: string, macAddress?: string) => {
    const cell = cells.find((c) => {
      if (c.id === cellId) return true;
      if (!macAddress) return false;
      return c.macAddress.trim().toLowerCase() === macAddress.trim().toLowerCase();
    });
    return cell ? `Cell ${cell.cellNumber}` : `Cell ${cellId}`;
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === 'unread') return !alert.read;
    if (filter === 'molt') return alert.type === 'molt';
    if (filter === 'moisture')
      return alert.type === 'moisture_low' || alert.type === 'moisture_high';
    if (filter === 'error')
      return alert.type === 'sensor_error' || alert.type === 'offline';
    return true;
  });

  const getAlertIcon = (type: string) => {
    if (type === 'molt') return <Bell className="w-5 h-5" />;
    if (type === 'moisture_low' || type === 'moisture_high')
      return <Droplets className="w-5 h-5" />;
    if (type === 'sensor_error') return <AlertCircle className="w-5 h-5" />;
    return <AlertCircle className="w-5 h-5" />;
  };

  const getAlertColor = (type: string) => {
    if (type === 'molt') return 'text-teal-400 bg-teal-500/10';
    if (type === 'moisture_low') return 'text-amber-400 bg-amber-500/10';
    if (type === 'moisture_high') return 'text-cyan-400 bg-cyan-500/10';
    if (type === 'sensor_error') return 'text-yellow-400 bg-yellow-500/10';
    return 'text-red-400 bg-red-500/10';
  };

  const getAlertLabel = (type: string) => {
    if (type === 'molt') return 'Molt Detected';
    if (type === 'moisture_low') return 'Low Moisture';
    if (type === 'moisture_high') return 'High Moisture';
    if (type === 'sensor_error') return 'Sensor Error';
    if (type === 'offline') return 'Offline';
    return 'Alert';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading alerts...</p>
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
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div ref={bellRef}>
                    <Bell className="w-8 h-8 text-cyan-400" />
                  </div>
                  <h1 className="text-4xl font-bold text-slate-100">
                    Alerts
                  </h1>
                </div>
                <p className="text-slate-400">
                  {alerts.filter((a) => !a.read).length} unread alert
                  {alerts.filter((a) => !a.read).length !== 1 ? 's' : ''}
                </p>
              </div>
              {alerts.length > 0 && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={clearAllAlerts}
                  className="px-4 py-2 text-sm font-bold bg-slate-700/50 text-slate-300 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-colors"
                >
                  Clear All
                </motion.button>
              )}
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              {[
                { label: 'All', value: 'all' as const },
                { label: 'Unread', value: 'unread' as const },
                { label: 'Molts', value: 'molt' as const },
                { label: 'Moisture', value: 'moisture' as const },
                { label: 'Errors', value: 'error' as const },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    filter === f.value
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                      : 'bg-slate-700/50 text-slate-400 border border-slate-600/50 hover:text-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {filteredAlerts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">
              {filter === 'unread'
                ? 'All caught up!'
                : 'No alerts yet'}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {filteredAlerts.map((alert, idx) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`p-6 rounded-lg border transition-all ${
                    alert.read
                      ? 'bg-slate-800/50 border-slate-700/50'
                      : 'bg-gradient-to-r from-slate-800/80 to-slate-700/50 border-cyan-500/30 ring-1 ring-cyan-500/20'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div
                      className={`p-3 rounded-lg flex-shrink-0 ${getAlertColor(
                        alert.type
                      )}`}
                    >
                      {getAlertIcon(alert.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-bold text-slate-100">
                            {getCellName(alert.cellId, alert.macAddress)} - {getAlertLabel(alert.type)}
                          </p>
                          <p className="text-sm text-slate-400 mt-1">
                            {alert.message}
                          </p>
                        </div>
                        {!alert.read && (
                          <div className="w-3 h-3 rounded-full bg-cyan-400 flex-shrink-0 mt-1" />
                        )}
                      </div>

                      <p className="text-xs text-slate-500">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!alert.read && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => markAlertAsRead(alert.id)}
                          className="p-2 text-slate-400 hover:text-green-400 hover:bg-green-500/10 rounded transition-colors"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </motion.button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
