'use client';

import { motion } from 'framer-motion';
import { Cell, Rack } from '@/lib/localStorage';
import { GripVertical, Trash2, Edit2 } from 'lucide-react';
import Link from 'next/link';

interface RackCardProps {
  rack: Rack;
  cells: Cell[];
}

export function RackCard({ rack, cells }: RackCardProps) {
  const capacityPercentage = (cells.length / rack.cellLimit) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/20 p-6 hover:border-cyan-500/40 transition-colors"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-slate-100">{rack.name}</h3>
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded text-blue-400 hover:bg-blue-500/10 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Capacity Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-400 mb-2">
          <span>Capacity</span>
          <span>{cells.length}/{rack.cellLimit}</span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-700/50 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${capacityPercentage}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-cyan-500 to-teal-500"
          />
        </div>
      </div>

      {/* Cells List */}
      <div className="space-y-2">
        {cells.length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">No cells assigned</p>
        ) : (
          cells.map((cell, idx) => (
            <motion.div
              key={cell.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-center gap-3 p-2 rounded bg-slate-700/30 hover:bg-slate-700/50 transition-colors"
            >
              <GripVertical className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 font-medium">Cell {cell.cellNumber}</p>
                <p className="text-xs text-slate-400 truncate">{cell.macAddress}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <div
                  className={`w-2 h-2 rounded-full ${
                    cell.ledStatus === 'on' ? 'bg-green-400' : 'bg-gray-400'
                  }`}
                />
                <span className="text-xs text-slate-400">
                  {cell.status === 'error' ? '❌' : '✓'}
                </span>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* See Details Link */}
      {cells.length > 0 && (
        <Link
          href={`/my-racks#${rack.id}`}
          className="inline-block mt-4 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          View Rack →
        </Link>
      )}
    </motion.div>
  );
}
