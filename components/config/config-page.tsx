'use client';

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Layers, RefreshCw, Save, Settings2, Zap } from 'lucide-react';
import { useMoltSense } from '@/lib/hooks/useMoltSense';
import { updateEsp32Config } from '@/lib/esp32';
import { storageUtils, Esp32Config, Rack, Cell, RackSet } from '@/lib/localStorage';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DurationField } from '@/components/config/duration-field';
import {
  applyWaterPreset,
  CONDUCTIVITY_UNIT,
  MOISTURE_UNIT,
  WATER_PRESETS,
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

const parseNumber = (value: string, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeDraft = (draft: ConfigDraft, fallback: Esp32Config): Esp32Config => ({
  conductivityThresholdStart: parseNumber(
    draft.conductivityThresholdStart,
    fallback.conductivityThresholdStart
  ),
  conductivityThresholdEnd: parseNumber(
    draft.conductivityThresholdEnd,
    fallback.conductivityThresholdEnd
  ),
  moistureThresholdLow: parseNumber(draft.moistureThresholdLow, fallback.moistureThresholdLow),
  moistureThresholdHigh: parseNumber(
    draft.moistureThresholdHigh,
    fallback.moistureThresholdHigh
  ),
  moltCooldownMs: parseNumber(draft.moltCooldownMs, fallback.moltCooldownMs),
  moistureIntervalMs: parseNumber(draft.moistureIntervalMs, fallback.moistureIntervalMs),
  conductivityIntervalMs: parseNumber(
    draft.conductivityIntervalMs,
    fallback.conductivityIntervalMs
  ),
  errorAfterMs: parseNumber(draft.errorAfterMs, fallback.errorAfterMs),
});

const normalizeWindow = (config: Esp32Config): Esp32Config => {
  const next = { ...config };
  if (next.conductivityThresholdStart < next.conductivityThresholdEnd) {
    const triggerHigh = next.conductivityThresholdEnd;
    const resetLow = next.conductivityThresholdStart;
    next.conductivityThresholdStart = triggerHigh;
    next.conductivityThresholdEnd = resetLow;
  }
  if (next.moistureThresholdLow > next.moistureThresholdHigh) {
    const low = next.moistureThresholdLow;
    next.moistureThresholdLow = next.moistureThresholdHigh;
    next.moistureThresholdHigh = low;
  }
  return next;
};

const toSetCellCount = (set: RackSet, racks: Rack[], cells: Cell[]) => {
  const rackIds = new Set(set.rackIds);
  return cells.filter((cell) => {
    const rack = racks.find((item) => item.id === cell.rackId);
    return Boolean(rack && rackIds.has(rack.id));
  }).length;
};

const toSetEffectiveConfig = (set: RackSet, globalConfig: Esp32Config): Esp32Config => {
  return normalizeWindow({
    ...globalConfig,
    ...(storageUtils.getSetEsp32Config(set.id) ?? {}),
  });
};

const applyPresetToDraft = (presetId: string, setGlobalDraft: Dispatch<SetStateAction<ConfigDraft>>) => {
  const preset = WATER_PRESETS.find((item) => item.id === presetId);
  if (!preset) return;
  setGlobalDraft((prev) => ({
    ...prev,
    conductivityThresholdStart: String(preset.conductivityThresholdStart),
    conductivityThresholdEnd: String(preset.conductivityThresholdEnd),
    moistureThresholdLow: String(preset.moistureThresholdLow),
    moistureThresholdHigh: String(preset.moistureThresholdHigh),
  }));
};

export function ConfigPage() {
  const { cells, sets } = useMoltSense();
  const [racks, setRacks] = useState<Rack[]>([]);
  const [globalDraft, setGlobalDraft] = useState<ConfigDraft>(() =>
    draftFromConfig(storageUtils.getEsp32Config())
  );
  const [setDrafts, setSetDrafts] = useState<Record<string, ConfigDraft>>({});
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingSets, setSavingSets] = useState<Record<string, boolean>>({});
  const [confirmAction, setConfirmAction] = useState<
    | { kind: 'save-global' }
    | { kind: 'save-set'; setId: string; setName: string }
    | { kind: 'reset-set'; setId: string; setName: string }
    | null
  >(null);
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

  const globalConfig = useMemo(
    () => normalizeWindow(normalizeDraft(globalDraft, storageUtils.getEsp32Config())),
    [globalDraft]
  );

  const setsWithMeta = useMemo(() => {
    return sets.map((set) => {
      const effectiveConfig = toSetEffectiveConfig(set, globalConfig);
      const draft = setDrafts[set.id] ?? draftFromPatch(storageUtils.getSetEsp32Config(set.id));
      const setCells = cells.filter((cell) => {
        const rack = racks.find((item) => item.id === cell.rackId);
        return Boolean(rack && rack.setId === set.id);
      });
      return {
        set,
        effectiveConfig,
        draft,
        cellCount: setCells.length,
        rackCount: set.rackIds.length,
        setCells,
      };
    });
  }, [sets, cells, racks, setDrafts, globalConfig]);

  const connectedCells = cells.length;
  const cellsWithOverrides = cells.filter((cell) => {
    return Object.keys(storageUtils.getCellEsp32Config(cell.id)).length > 0;
  }).length;
  const setsWithOverrides = sets.filter((set) => {
    return Object.keys(storageUtils.getSetEsp32Config(set.id)).length > 0;
  }).length;

  const syncCells = async (targets: Cell[]) => {
    await Promise.all(
      targets.map(async (cell) => {
        const resolved = storageUtils.resolveEsp32ConfigForCell(cell.id);
        await updateEsp32Config(resolved, 'device', cell.macAddress);
      })
    );
  };

  const saveGlobalConfig = async () => {
    const next = normalizeWindow(normalizeDraft(globalDraft, storageUtils.getEsp32Config()));
    setSavingGlobal(true);
    try {
      storageUtils.setEsp32Config(next);
      await syncCells(cells);
    } finally {
      setSavingGlobal(false);
    }
  };

  const requestGlobalSave = () => {
    if (savingGlobal || isActionLocked) return;
    setConfirmAction({ kind: 'save-global' });
  };

  const requestSetSave = (setId: string, setName: string) => {
    if (savingSets[setId] || isActionLocked) return;
    setConfirmAction({ kind: 'save-set', setId, setName });
  };

  const requestSetReset = (setId: string, setName: string) => {
    if (savingSets[setId] || isActionLocked) return;
    setConfirmAction({ kind: 'reset-set', setId, setName });
  };

  const runConfirmedAction = async () => {
    const action = confirmAction;
    if (!action) return;
    setConfirmAction(null);
    setActionLockUntil(Date.now() + 1500);

    if (action.kind === 'save-global') {
      await saveGlobalConfig();
      return;
    }
    if (action.kind === 'save-set') {
      await saveSetConfig(action.setId);
      return;
    }
    await resetSetConfig(action.setId);
  };

  const saveSetConfig = async (setId: string) => {
    const draft = setDrafts[setId] ?? draftFromPatch(storageUtils.getSetEsp32Config(setId));
    const patch = patchFromDraft(draft);

    setSavingSets((prev) => ({ ...prev, [setId]: true }));
    try {
      storageUtils.setSetEsp32Config(setId, patch);
      const affectedCells = cells.filter((cell) => {
        const rack = racks.find((item) => item.id === cell.rackId);
        return Boolean(rack && rack.setId === setId);
      });
      await syncCells(affectedCells);
    } finally {
      setSavingSets((prev) => ({ ...prev, [setId]: false }));
    }
  };

  const resetSetConfig = async (setId: string) => {
    setSavingSets((prev) => ({ ...prev, [setId]: true }));
    try {
      storageUtils.clearSetEsp32Config(setId);
      setSetDrafts((prev) => {
        const next = { ...prev };
        delete next[setId];
        return next;
      });
      const affectedCells = cells.filter((cell) => {
        const rack = racks.find((item) => item.id === cell.rackId);
        return Boolean(rack && rack.setId === setId);
      });
      await syncCells(affectedCells);
    } finally {
      setSavingSets((prev) => ({ ...prev, [setId]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="border-b border-cyan-500/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <Settings2 className="w-8 h-8 text-cyan-400" />
              <h1 className="text-4xl font-bold text-slate-100">Config</h1>
            </div>
            <p className="text-slate-400 max-w-3xl">
              Use this page for bulk overrides only. Global settings apply to every device, and
              set-level settings apply to all cells in that set unless a cell has its own override.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            {
              label: 'Connected cells',
              value: connectedCells,
              icon: Zap,
              tone: 'from-cyan-500/10 to-teal-500/10 border-cyan-500/30',
            },
            {
              label: 'Set overrides',
              value: setsWithOverrides,
              icon: Layers,
              tone: 'from-amber-500/10 to-orange-500/10 border-amber-500/30',
            },
            {
              label: 'Cell overrides',
              value: cellsWithOverrides,
              icon: CheckCircle2,
              tone: 'from-rose-500/10 to-pink-500/10 border-rose-500/30',
            },
            {
              label: 'Global cooldown',
              value: formatDuration(globalConfig.moltCooldownMs),
              icon: RefreshCw,
              tone: 'from-slate-500/10 to-slate-700/10 border-slate-600/40',
            },
          ].map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`rounded-lg border bg-gradient-to-br ${stat.tone} p-4`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold text-slate-100">{stat.value}</p>
                  </div>
                  <Icon className="w-6 h-6 text-cyan-300" />
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-cyan-500/20 bg-slate-800/50 p-6"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-100">All Devices</h2>
              <p className="text-slate-400">
                Update the baseline for every connected cell. Set and cell overrides still apply on
                top of this global layer.
              </p>
            </div>
            <button
              onClick={requestGlobalSave}
              disabled={savingGlobal || isActionLocked}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 hover:border-cyan-500/60 transition-colors disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {savingGlobal ? 'Saving...' : 'Save & Sync All'}
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {WATER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPresetToDraft(preset.id, setGlobalDraft)}
                  className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-4 text-left hover:border-cyan-500/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-slate-100">{preset.label}</p>
                    <span className="text-[11px] text-cyan-300">{preset.rangeLabel}</span>
                  </div>
                  <p className="text-xs text-slate-400">{preset.description}</p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <p className="text-xs text-slate-400">Molt trigger band</p>
                    <p className="text-[11px] text-slate-500">
                      Fire when conductivity rises above the high threshold and re-arm once it
                      falls to the low threshold.
                    </p>
                  </div>
                  <span className="text-[11px] text-cyan-300">{CONDUCTIVITY_UNIT}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={globalDraft.conductivityThresholdStart}
                    onChange={(event) =>
                      setGlobalDraft((prev) => ({
                        ...prev,
                        conductivityThresholdStart: event.target.value,
                      }))
                    }
                    className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                    placeholder="300"
                  />
                  <span className="text-slate-500 text-sm">to</span>
                  <input
                    type="number"
                    value={globalDraft.conductivityThresholdEnd}
                    onChange={(event) =>
                      setGlobalDraft((prev) => ({
                        ...prev,
                        conductivityThresholdEnd: event.target.value,
                      }))
                    }
                    className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                    placeholder="200"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {formatConductivityWindow(globalConfig)}
                </p>
              </div>

              <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <p className="text-xs text-slate-400">Moisture alert band</p>
                    <p className="text-[11px] text-slate-500">
                      Values inside this band are treated as normal moisture.
                    </p>
                  </div>
                  <span className="text-[11px] text-cyan-300">{MOISTURE_UNIT}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={globalDraft.moistureThresholdLow}
                    onChange={(event) =>
                      setGlobalDraft((prev) => ({
                        ...prev,
                        moistureThresholdLow: event.target.value,
                      }))
                    }
                    className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                    placeholder="30"
                  />
                  <span className="text-slate-500 text-sm">/</span>
                  <input
                    type="number"
                    value={globalDraft.moistureThresholdHigh}
                    onChange={(event) =>
                      setGlobalDraft((prev) => ({
                        ...prev,
                        moistureThresholdHigh: event.target.value,
                      }))
                    }
                    className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                    placeholder="80"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {formatMoistureWindow(globalConfig)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DurationField
                label="Molt cooldown"
                helperText="Wait before the next molt alert can fire."
                valueMs={parseNumber(globalDraft.moltCooldownMs, globalConfig.moltCooldownMs)}
                onChange={(ms) =>
                  setGlobalDraft((prev) => ({ ...prev, moltCooldownMs: String(ms) }))
                }
                minValueMs={0}
              />
              <DurationField
                label="Moisture check every"
                helperText="How often the ESP32 samples the moisture sensor."
                valueMs={parseNumber(
                  globalDraft.moistureIntervalMs,
                  globalConfig.moistureIntervalMs
                )}
                onChange={(ms) =>
                  setGlobalDraft((prev) => ({ ...prev, moistureIntervalMs: String(ms) }))
                }
                minValueMs={1000}
              />
              <DurationField
                label="Conductivity check every"
                helperText="How often the ESP32 samples the conductivity probe."
                valueMs={parseNumber(
                  globalDraft.conductivityIntervalMs,
                  globalConfig.conductivityIntervalMs
                )}
                onChange={(ms) =>
                  setGlobalDraft((prev) => ({ ...prev, conductivityIntervalMs: String(ms) }))
                }
                minValueMs={250}
              />
              <DurationField
                label="Sensor fault timeout"
                helperText="If conductivity stays at zero this long, the device enters error mode."
                valueMs={parseNumber(globalDraft.errorAfterMs, globalConfig.errorAfterMs)}
                onChange={(ms) =>
                  setGlobalDraft((prev) => ({ ...prev, errorAfterMs: String(ms) }))
                }
                minValueMs={1000}
              />
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
              <h2 className="text-2xl font-bold text-slate-100">By Set</h2>
              <p className="text-slate-400">
                Set-level overrides apply to all cells inside the set unless a cell has its own
                local override.
              </p>
            </div>
            <p className="text-sm text-slate-500">
              Blank fields inherit from the global layer.
            </p>
          </div>

          {setsWithMeta.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-700/60 bg-slate-900/40 p-6 text-slate-400">
              No sets configured yet.
            </div>
          ) : (
            <div className="space-y-4">
              {setsWithMeta.map(({ set, draft, effectiveConfig, cellCount, rackCount, setCells }) => (
                <div
                  key={set.id}
                  className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-4"
                >
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between mb-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{set.name}</p>
                      <p className="text-xs text-slate-400">
                        {rackCount} rack{rackCount !== 1 ? 's' : ''} · {cellCount} cell
                        {cellCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
                      <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1">
                        {formatConductivityWindow(effectiveConfig)}
                      </span>
                      <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-1">
                        {formatMoistureWindow(effectiveConfig)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-[11px] text-slate-500">Molt trigger band</p>
                        <span className="text-[11px] text-cyan-300">{CONDUCTIVITY_UNIT}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={draft.conductivityThresholdStart}
                          placeholder={String(effectiveConfig.conductivityThresholdStart)}
                          onChange={(event) =>
                            setSetDrafts((prev) => ({
                              ...prev,
                              [set.id]: {
                                ...draft,
                                conductivityThresholdStart: event.target.value,
                              },
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
                            setSetDrafts((prev) => ({
                              ...prev,
                              [set.id]: {
                                ...draft,
                                conductivityThresholdEnd: event.target.value,
                              },
                            }))
                          }
                          className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-[11px] text-slate-500">Moisture alert band</p>
                        <span className="text-[11px] text-cyan-300">{MOISTURE_UNIT}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={draft.moistureThresholdLow}
                          placeholder={String(effectiveConfig.moistureThresholdLow)}
                          onChange={(event) =>
                            setSetDrafts((prev) => ({
                              ...prev,
                              [set.id]: {
                                ...draft,
                                moistureThresholdLow: event.target.value,
                              },
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
                            setSetDrafts((prev) => ({
                              ...prev,
                              [set.id]: {
                                ...draft,
                                moistureThresholdHigh: event.target.value,
                              },
                            }))
                          }
                          className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                        />
                      </div>
                    </div>

                    <DurationField
                      label="Molt cooldown"
                      helperText="Wait before another molt alert can trigger for this set."
                      valueMs={parseNumber(draft.moltCooldownMs, effectiveConfig.moltCooldownMs)}
                      onChange={(ms) =>
                        setSetDrafts((prev) => ({
                          ...prev,
                          [set.id]: { ...draft, moltCooldownMs: String(ms) },
                        }))
                      }
                      minValueMs={0}
                    />

                    <DurationField
                      label="Moisture check every"
                      helperText="How often the ESP32 reads the mapped moisture percentage."
                      valueMs={parseNumber(
                        draft.moistureIntervalMs,
                        effectiveConfig.moistureIntervalMs
                      )}
                      onChange={(ms) =>
                        setSetDrafts((prev) => ({
                          ...prev,
                          [set.id]: { ...draft, moistureIntervalMs: String(ms) },
                        }))
                      }
                      minValueMs={1000}
                    />

                    <DurationField
                      label="Conductivity check every"
                      helperText="How often the ESP32 checks the conductivity window."
                      valueMs={parseNumber(
                        draft.conductivityIntervalMs,
                        effectiveConfig.conductivityIntervalMs
                      )}
                      onChange={(ms) =>
                        setSetDrafts((prev) => ({
                          ...prev,
                          [set.id]: { ...draft, conductivityIntervalMs: String(ms) },
                        }))
                      }
                      minValueMs={250}
                    />

                    <DurationField
                      label="Sensor fault timeout"
                      helperText="If conductivity stays at zero this long, the set enters error mode."
                      valueMs={parseNumber(draft.errorAfterMs, effectiveConfig.errorAfterMs)}
                      onChange={(ms) =>
                        setSetDrafts((prev) => ({
                          ...prev,
                          [set.id]: { ...draft, errorAfterMs: String(ms) },
                        }))
                      }
                      minValueMs={1000}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      onClick={() => requestSetSave(set.id, set.name)}
                      disabled={savingSets[set.id] || isActionLocked}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 text-sm disabled:opacity-60"
                    >
                      <Save className="w-4 h-4" />
                      {savingSets[set.id] ? 'Saving...' : 'Save Set Override'}
                    </button>
                    <button
                      onClick={() => requestSetReset(set.id, set.name)}
                      disabled={savingSets[set.id] || isActionLocked}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded bg-slate-700/50 text-slate-200 border border-slate-600/50 text-sm disabled:opacity-60"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reset to Global
                    </button>
                  </div>

                  {setCells.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {setCells.slice(0, 6).map((cell) => (
                        <span
                          key={cell.id}
                          className="rounded-full border border-slate-700/60 bg-slate-800/60 px-2 py-1 text-[11px] text-slate-300"
                        >
                          Cell {cell.cellNumber}
                        </span>
                      ))}
                      {setCells.length > 6 && (
                        <span className="rounded-full border border-slate-700/60 bg-slate-800/60 px-2 py-1 text-[11px] text-slate-400">
                          +{setCells.length - 6} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.section>
      </div>

      <ConfirmDialog
        open={confirmAction !== null}
        title={
          confirmAction?.kind === 'save-global'
            ? 'Sync global settings?'
            : confirmAction?.kind === 'save-set'
              ? `Save override for ${confirmAction.setName}?`
              : 'Reset set override?'
        }
        description={
          confirmAction?.kind === 'save-global'
            ? 'This will push the current global settings to every connected device.'
            : confirmAction?.kind === 'save-set'
              ? 'This will save the set override and sync the affected devices.'
              : 'This will remove the set override and re-sync the affected devices.'
        }
        confirmLabel="Proceed"
        cancelLabel="Cancel"
        onConfirm={runConfirmedAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
