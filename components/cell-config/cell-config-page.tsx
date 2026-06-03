'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, Save, Settings2 } from 'lucide-react';
import { useMoltSense } from '@/lib/hooks/useMoltSense';
import { updateEsp32Config } from '@/lib/esp32';
import { storageUtils, Esp32Config, Rack } from '@/lib/localStorage';

type ConfigDraft = {
  conductivityThresholdStart: string;
  conductivityThresholdEnd: string;
  moistureThresholdLow: string;
  moistureThresholdHigh: string;
  moltCooldownMs: string;
  moistureIntervalMs: string;
  conductivityIntervalMs: string;
  errorAfterMs: string;
};

const draftFromPatch = (patch: Partial<Esp32Config>): ConfigDraft => ({
  conductivityThresholdStart:
    patch.conductivityThresholdStart !== undefined
      ? String(patch.conductivityThresholdStart)
      : '',
  conductivityThresholdEnd:
    patch.conductivityThresholdEnd !== undefined ? String(patch.conductivityThresholdEnd) : '',
  moistureThresholdLow:
    patch.moistureThresholdLow !== undefined ? String(patch.moistureThresholdLow) : '',
  moistureThresholdHigh:
    patch.moistureThresholdHigh !== undefined ? String(patch.moistureThresholdHigh) : '',
  moltCooldownMs: patch.moltCooldownMs !== undefined ? String(patch.moltCooldownMs) : '',
  moistureIntervalMs: patch.moistureIntervalMs !== undefined ? String(patch.moistureIntervalMs) : '',
  conductivityIntervalMs:
    patch.conductivityIntervalMs !== undefined ? String(patch.conductivityIntervalMs) : '',
  errorAfterMs: patch.errorAfterMs !== undefined ? String(patch.errorAfterMs) : '',
});

const patchFromDraft = (draft: ConfigDraft): Partial<Esp32Config> => {
  const patch: Partial<Esp32Config> = {};
  const maybeSet = (key: keyof Esp32Config, value: string) => {
    if (value.trim() === '') return;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      patch[key] = parsed;
    }
  };

  maybeSet('conductivityThresholdStart', draft.conductivityThresholdStart);
  maybeSet('conductivityThresholdEnd', draft.conductivityThresholdEnd);
  maybeSet('moistureThresholdLow', draft.moistureThresholdLow);
  maybeSet('moistureThresholdHigh', draft.moistureThresholdHigh);
  maybeSet('moltCooldownMs', draft.moltCooldownMs);
  maybeSet('moistureIntervalMs', draft.moistureIntervalMs);
  maybeSet('conductivityIntervalMs', draft.conductivityIntervalMs);
  maybeSet('errorAfterMs', draft.errorAfterMs);

  return patch;
};

const defaultDraft: ConfigDraft = {
  conductivityThresholdStart: '',
  conductivityThresholdEnd: '',
  moistureThresholdLow: '',
  moistureThresholdHigh: '',
  moltCooldownMs: '',
  moistureIntervalMs: '',
  conductivityIntervalMs: '',
  errorAfterMs: '',
};

const formatMs = (value: number) => {
  if (value >= 60_000) return `${Math.round(value / 60_000)} min`;
  if (value >= 1000) return `${Math.round(value / 1000)} sec`;
  return `${value} ms`;
};

export function CellConfigPage() {
  const params = useParams();
  const cellId = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const { cells, sets, isLoading } = useMoltSense();
  const [racks, setRacks] = useState<Rack[]>([]);
  const [draft, setDraft] = useState<ConfigDraft>(defaultDraft);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRacks(storageUtils.getRacks());
  }, [cells.length, sets.length]);

  const cell = useMemo(
    () => cells.find((item) => item.id === cellId),
    [cells, cellId]
  );

  const rack = useMemo(
    () => racks.find((item) => item.id === cell?.rackId),
    [racks, cell?.rackId]
  );

  const parentSet = useMemo(
    () => sets.find((item) => item.rackIds.includes(rack?.id ?? '')),
    [sets, rack?.id]
  );

  const globalConfig = useMemo(() => storageUtils.getEsp32Config(), []);
  const setPatch = useMemo(() => storageUtils.getSetEsp32Config(parentSet?.id ?? ''), [parentSet?.id]);
  const cellPatch = useMemo(
    () => storageUtils.getCellEsp32Config(cell?.id ?? ''),
    [cell?.id]
  );

  const effectiveConfig = useMemo(() => {
    if (!cell) return globalConfig;
    return storageUtils.resolveEsp32ConfigForCell(cell.id);
  }, [cell, globalConfig, setPatch, cellPatch]);

  useEffect(() => {
    if (!cell) return;
    setDraft(draftFromPatch(cellPatch));
  }, [cell?.id, cellPatch]);

  const saveCellConfig = async () => {
    if (!cell) return;
    const patch = patchFromDraft(draft);
    setSaving(true);
    try {
      storageUtils.setCellEsp32Config(cell.id, patch);
      await updateEsp32Config(storageUtils.resolveEsp32ConfigForCell(cell.id), 'device', cell.macAddress);
    } finally {
      setSaving(false);
    }
  };

  const resetCellConfig = async () => {
    if (!cell) return;
    setSaving(true);
    try {
      storageUtils.clearCellEsp32Config(cell.id);
      setDraft(defaultDraft);
      await updateEsp32Config(storageUtils.resolveEsp32ConfigForCell(cell.id), 'device', cell.macAddress);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading cell config...</p>
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
      <div className="border-b border-cyan-500/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link href={`/cell/${cell.id}/history`} className="text-cyan-300 flex items-center gap-2 mb-4">
                <ArrowLeft className="w-4 h-4" />
                Back to cell history
              </Link>
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-center gap-3 mb-2">
                  <Settings2 className="w-8 h-8 text-cyan-400" />
                  <h1 className="text-4xl font-bold text-slate-100">
                    Cell {cell.cellNumber} Config
                  </h1>
                </div>
                <p className="text-slate-400">
                  Individual overrides live here. Blank fields keep inheriting from your set and
                  global defaults.
                </p>
              </motion.div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
                Global {formatMs(globalConfig.moltCooldownMs)}
              </span>
              {parentSet && (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
                  Set: {parentSet.name}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-cyan-500/20 bg-slate-800/50 p-6"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-100">Effective Settings</h2>
              <p className="text-slate-400">
                This is what the cell currently runs with after global, set, and cell overrides
                are merged.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-4">
              <p className="text-xs text-slate-400 mb-2">Molting at (conductivity)</p>
              <p className="text-lg font-semibold text-slate-100">
                {effectiveConfig.conductivityThresholdStart} to {effectiveConfig.conductivityThresholdEnd}
              </p>
            </div>
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-4">
              <p className="text-xs text-slate-400 mb-2">Low / High moisture</p>
              <p className="text-lg font-semibold text-slate-100">
                {effectiveConfig.moistureThresholdLow} / {effectiveConfig.moistureThresholdHigh}
              </p>
            </div>
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-4">
              <p className="text-xs text-slate-400 mb-2">Molt cooldown</p>
              <p className="text-lg font-semibold text-slate-100">
                {formatMs(effectiveConfig.moltCooldownMs)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-4">
              <p className="text-xs text-slate-400 mb-2">Sensor timing</p>
              <p className="text-lg font-semibold text-slate-100">
                Moisture {formatMs(effectiveConfig.moistureIntervalMs)} · Conductivity{' '}
                {formatMs(effectiveConfig.conductivityIntervalMs)}
              </p>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-cyan-500/20 bg-slate-800/50 p-6"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-100">Cell Override</h2>
              <p className="text-slate-400">
                Leave a field blank to keep inheriting from the parent set/global layer. Save only
                the values you want this one cell to override.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveCellConfig}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 hover:border-cyan-500/60 transition-colors disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Override'}
              </button>
              <button
                onClick={resetCellConfig}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700/50 text-slate-200 border border-slate-600/50 hover:border-slate-500/60 transition-colors disabled:opacity-60"
              >
                <RefreshCw className="w-4 h-4" />
                Reset to Inherited
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-4">
              <p className="text-xs text-slate-400 mb-2">Molting at (conductivity)</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={draft.conductivityThresholdStart}
                  placeholder={String(effectiveConfig.conductivityThresholdStart)}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      conductivityThresholdStart: event.target.value,
                    }))
                  }
                  className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                />
                <span className="text-slate-500 text-sm">to</span>
                <input
                  type="number"
                  value={draft.conductivityThresholdEnd}
                  placeholder={String(effectiveConfig.conductivityThresholdEnd)}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      conductivityThresholdEnd: event.target.value,
                    }))
                  }
                  className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                />
              </div>
            </div>

            <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-4">
              <p className="text-xs text-slate-400 mb-2">Low / High moisture</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={draft.moistureThresholdLow}
                  placeholder={String(effectiveConfig.moistureThresholdLow)}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      moistureThresholdLow: event.target.value,
                    }))
                  }
                  className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                />
                <span className="text-slate-500 text-sm">/</span>
                <input
                  type="number"
                  value={draft.moistureThresholdHigh}
                  placeholder={String(effectiveConfig.moistureThresholdHigh)}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      moistureThresholdHigh: event.target.value,
                    }))
                  }
                  className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                />
              </div>
            </div>

            <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-4">
              <p className="text-xs text-slate-400 mb-2">Molt cooldown</p>
              <input
                type="number"
                value={draft.moltCooldownMs}
                placeholder={String(effectiveConfig.moltCooldownMs)}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, moltCooldownMs: event.target.value }))
                }
                className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100"
              />
            </div>

            <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-4">
              <p className="text-xs text-slate-400 mb-2">Sensor timing</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="number"
                  value={draft.moistureIntervalMs}
                  placeholder={String(effectiveConfig.moistureIntervalMs)}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, moistureIntervalMs: event.target.value }))
                  }
                  className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                />
                <input
                  type="number"
                  value={draft.conductivityIntervalMs}
                  placeholder={String(effectiveConfig.conductivityIntervalMs)}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, conductivityIntervalMs: event.target.value }))
                  }
                  className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                />
                <input
                  type="number"
                  value={draft.errorAfterMs}
                  placeholder={String(effectiveConfig.errorAfterMs)}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, errorAfterMs: event.target.value }))
                  }
                  className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                />
              </div>
            </div>
          </div>
        </motion.section>

        {rack && parentSet && (
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4 text-sm text-slate-300">
            This cell belongs to <span className="text-cyan-300">{rack.name}</span> in{' '}
            <span className="text-cyan-300">{parentSet.name}</span>.
          </div>
        )}
      </div>
    </div>
  );
}
