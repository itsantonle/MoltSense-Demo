'use client';

import { motion } from 'framer-motion';
import { useMoltSense } from '@/lib/hooks/useMoltSense';
import { Wifi, WifiOff, Server } from 'lucide-react';

export function HubsPage() {
  const { hubs, cells, isLoading } = useMoltSense();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading hubs...</p>
        </div>
      </div>
    );
  }

  const getCellsForHub = (hubId: string) => {
    return cells.filter((c) => c.hubId === hubId);
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
              Hub Management
            </h1>
            <p className="text-slate-400">
              Monitor and manage your hub controllers
            </p>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {hubs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Server className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">No hubs configured yet</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hubs.map((hub, idx) => {
              const hubCells = getCellsForHub(hub.id);
              const activeCells = hubCells.filter(
                (c) => c.status === 'active'
              ).length;

              return (
                <motion.div
                  key={hub.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  whileHover={{ y: -4 }}
                  className="p-6 rounded-lg bg-gradient-to-br from-slate-800/50 to-slate-700/50 border border-cyan-500/20 hover:border-cyan-500/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-slate-100 mb-1">
                        {hub.name}
                      </h3>
                      <p className="text-xs text-slate-500 font-mono">
                        {hub.macAddress}
                      </p>
                    </div>
                    <div
                      className={`p-2 rounded-lg ${
                        hub.status === 'online'
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {hub.status === 'online' ? (
                        <Wifi className="w-5 h-5" />
                      ) : (
                        <WifiOff className="w-5 h-5" />
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Cells</p>
                      <div className="flex items-end gap-2">
                        <p className="text-2xl font-bold text-slate-100">
                          {activeCells}
                        </p>
                        <p className="text-xs text-slate-500 mb-1">
                          / {hub.cellCapacity}
                        </p>
                      </div>
                    </div>

                    <div className="w-full bg-slate-900/50 rounded-full h-2">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-all"
                        style={{
                          width: `${
                            (activeCells / hub.cellCapacity) * 100
                          }%`,
                        }}
                      />
                    </div>

                    <div className="text-xs text-slate-500">
                      Last heartbeat:{' '}
                      {new Date(hub.lastHeartbeat).toLocaleTimeString()}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
