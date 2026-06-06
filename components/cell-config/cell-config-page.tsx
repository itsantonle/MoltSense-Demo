'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, RotateCcw, Save, Settings2 } from 'lucide-react';
import { useMoltSense } from '@/lib/hooks/useMoltSense';
import { requestEsp32ConfigSnapshot, updateEsp32Config } from '@/lib/esp32';
import { storageUtils, Esp32Config, Rack } from '@/lib/localStorage';
import { DurationField } from '@/components/config/duration-field';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  CONDUCTIVITY_UNIT,
  MOISTURE_UNIT,
  formatConductivityWindow,
  formatDuration,
  formatMoistureWindow,
} from '@/lib/esp32-config-ui';

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

const draftFromConfig = (config: Esp32Config): ConfigDraft => ({
  conductivityThresholdStart: String(config.conductivityThresholdStart),
  conductivityThresholdEnd: String(config.conductivityThresholdEnd),
  moistureThresholdLow: String(config.moistureThresholdLow),
  moistureThresholdHigh: String(config.moistureThresholdHigh),
  moltCooldownMs: String(config.moltCooldownMs),
  moistureIntervalMs: String(config.moistureIntervalMs),
  conductivityIntervalMs: String(config.conductivityIntervalMs),
  errorAfterMs: String(config.errorAfterMs),
});

const parseNumber = (value: string, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

export function CellConfigPage() {
  const params = useParams();
  const cellId = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const { cells, sets, isLoading } = useMoltSense();
  const [racks, setRacks] = useState<Rack[]>([]);
  const [draft, setDraft] = useState<ConfigDraft>(defaultDraft);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'save' | 'reset' | null>(null);
  const [actionLockUntil, setActionLockUntil] = useState(0);

  useEffect(() => {
    setRacks(storageUtils.getRacks());
  }, [cells.length, sets.length]);

  useEffect(() => {
    if (actionLockUntil <= Date.now()) return;
    const timeout = window.setTimeout(() => setActionLockUntil(0), actionLockUntil - Date.now());
    return () => window.clearTimeout(timeout);
  }, [actionLockUntil]);

  const isActionLocked = actionLockUntil > Date.now();

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

  const syncCellValues = async () => {
    if (!cell) return;
    setSyncing(true);
    try {
      const response = await requestEsp32ConfigSnapshot(cell.macAddress);
      setDraft(draftFromConfig(response.config));
    } finally {
      setSyncing(false);
    }
  };

  const requestSave = () => {
    if (saving || isActionLocked) return;
    setConfirmAction('save');
  };

  const requestReset = () => {
    if (saving || isActionLocked) return;
    setConfirmAction('reset');
  };

  const runConfirmedAction = async () => {
    const action = confirmAction;
    if (!action) return;
    setConfirmAction(null);
    setActionLockUntil(Date.now() + 1500);

    if (action === 'save') {
      await saveCellConfig();
      return;
    }
    await resetCellConfig();
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
                Global cooldown {formatDuration(globalConfig.moltCooldownMs)}
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
              <p className="text-xs text-slate-400 mb-2">Conductivity hysteresis window</p>
              <p className="text-lg font-semibold text-slate-100">
                {formatConductivityWindow(effectiveConfig)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-4">
              <p className="text-xs text-slate-400 mb-2">Moisture alert band</p>
              <p className="text-lg font-semibold text-slate-100">
                {formatMoistureWindow(effectiveConfig)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-4">
              <p className="text-xs text-slate-400 mb-2">Molt cooldown</p>
              <p className="text-lg font-semibold text-slate-100">
                {formatDuration(effectiveConfig.moltCooldownMs)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-4">
              <p className="text-xs text-slate-400 mb-2">Sensor timing</p>
              <p className="text-lg font-semibold text-slate-100">
                Moisture {formatDuration(effectiveConfig.moistureIntervalMs)} · Conductivity{' '}
                {formatDuration(effectiveConfig.conductivityIntervalMs)}
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
            <div className="flex flex-wrap gap-2">
              <button
                onClick={syncCellValues}
                disabled={syncing || saving || isActionLocked}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700/50 text-slate-200 border border-slate-600/50 hover:border-slate-500/60 transition-colors disabled:opacity-60"
              >
                <RotateCcw className="w-4 h-4" />
                {syncing ? 'Syncing...' : 'Sync Cell Data'}
              </button>
              <button
                onClick={requestSave}
                disabled={saving || syncing || isActionLocked}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 hover:border-cyan-500/60 transition-colors disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Override'}
              </button>
              <button
                onClick={requestReset}
                disabled={saving || syncing || isActionLocked}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700/50 text-slate-200 border border-slate-600/50 hover:border-slate-500/60 transition-colors disabled:opacity-60"
              >
                <RefreshCw className="w-4 h-4" />
                Reset to Inherited
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-4">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-xs text-slate-400">Conductivity hysteresis window</p>
                <span className="text-[11px] text-cyan-300">{CONDUCTIVITY_UNIT}</span>
              </div>
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
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-xs text-slate-400">Moisture alert band</p>
                <span className="text-[11px] text-cyan-300">{MOISTURE_UNIT}</span>
              </div>
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

            <DurationField
              label="Molt cooldown"
              helperText="Wait before this cell can alert again."
              valueMs={parseNumber(draft.moltCooldownMs, effectiveConfig.moltCooldownMs)}
              onChange={(ms) => setDraft((prev) => ({ ...prev, moltCooldownMs: String(ms) }))}
              minValueMs={0}
            />

            <DurationField
              label="Moisture check every"
              helperText="How often this cell reports the mapped moisture percentage."
              valueMs={parseNumber(draft.moistureIntervalMs, effectiveConfig.moistureIntervalMs)}
              onChange={(ms) =>
                setDraft((prev) => ({ ...prev, moistureIntervalMs: String(ms) }))
              }
              minValueMs={1000}
            />

            <DurationField
              label="Conductivity check every"
              helperText="How often this cell samples the conductivity sensor."
              valueMs={parseNumber(
                draft.conductivityIntervalMs,
                effectiveConfig.conductivityIntervalMs
              )}
              onChange={(ms) =>
                setDraft((prev) => ({ ...prev, conductivityIntervalMs: String(ms) }))
              }
              minValueMs={250}
            />

            <DurationField
              label="Sensor fault timeout"
              helperText="If conductivity stays at zero this long, the cell enters error mode."
              valueMs={parseNumber(draft.errorAfterMs, effectiveConfig.errorAfterMs)}
              onChange={(ms) => setDraft((prev) => ({ ...prev, errorAfterMs: String(ms) }))}
              minValueMs={1000}
            />
          </div>
        </motion.section>

        {rack && parentSet && (
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4 text-sm text-slate-300">
            This cell belongs to <span className="text-cyan-300">{rack.name}</span> in{' '}
            <span className="text-cyan-300">{parentSet.name}</span>.
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction === 'save' ? 'Save cell override?' : 'Reset cell override?'}
        description={
          confirmAction === 'save'
            ? 'This will write the current cell override and sync it to the ESP32.'
            : 'This will clear the cell override and re-sync the inherited settings.'
        }
        confirmLabel="Proceed"
        cancelLabel="Cancel"
        onConfirm={runConfirmedAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
