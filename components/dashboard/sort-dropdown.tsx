'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type SortOption = 'recent' | 'status' | 'name' | 'hub';

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'recent', label: 'Sort by Recent' },
  { value: 'status', label: 'Sort by Status' },
  { value: 'name', label: 'Sort by Name' },
  { value: 'hub', label: 'Sort by Hub' },
];

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = sortOptions.find((opt) => opt.value === value)?.label || 'Sort';

  return (
    <div className="relative">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-2 w-full px-4 py-2 rounded-lg bg-slate-800 border border-cyan-500/30 text-slate-100 font-medium hover:border-cyan-500/50 transition-colors"
        whileHover={{ borderColor: 'rgba(0, 188, 212, 0.5)' }}
      >
        <span>{selectedLabel}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 mt-2 rounded-lg bg-slate-800 border border-cyan-500/30 shadow-xl z-50"
          >
            {sortOptions.map((option) => (
              <motion.button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2 text-left font-medium transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  value === option.value
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'text-slate-300 hover:bg-slate-700/50'
                }`}
                whileHover={{ backgroundColor: 'rgba(0, 188, 212, 0.1)' }}
              >
                {option.label}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
