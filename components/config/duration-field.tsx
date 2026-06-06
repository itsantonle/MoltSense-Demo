'use client';

import { useEffect, useState } from 'react';
import {
  chooseDurationUnit,
  convertDurationToMs,
  convertMsToDuration,
  durationUnitOptions,
  DurationUnit,
  formatDuration,
} from '@/lib/esp32-config-ui';

interface DurationFieldProps {
  label: string;
  valueMs: number;
  onChange: (valueMs: number) => void;
  helperText?: string;
  minValueMs?: number;
}

const roundForDisplay = (value: number) => {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(2)));
};

export function DurationField({
  label,
  valueMs,
  onChange,
  helperText,
  minValueMs = 0,
}: DurationFieldProps) {
  const [displayValue, setDisplayValue] = useState<string>(() =>
    roundForDisplay(convertMsToDuration(valueMs, chooseDurationUnit(valueMs)))
  );
  const [unit, setUnit] = useState<DurationUnit>(() => chooseDurationUnit(valueMs));

  useEffect(() => {
    setUnit(chooseDurationUnit(valueMs));
    setDisplayValue(
      roundForDisplay(convertMsToDuration(valueMs, chooseDurationUnit(valueMs)))
    );
  }, [valueMs]);

  const commitValue = (nextDisplayValue: string, nextUnit: DurationUnit) => {
    setDisplayValue(nextDisplayValue);
    const parsed = Number(nextDisplayValue);
    if (!Number.isFinite(parsed)) return;
    onChange(Math.max(minValueMs, convertDurationToMs(parsed, nextUnit)));
  };

  const handleUnitChange = (nextUnit: DurationUnit) => {
    const parsed = Number(displayValue);
    if (Number.isFinite(parsed)) {
      const currentMs = convertDurationToMs(parsed, unit);
      const nextDisplayValue = roundForDisplay(convertMsToDuration(currentMs, nextUnit));
      setDisplayValue(nextDisplayValue);
      onChange(Math.max(minValueMs, currentMs));
    }
    setUnit(nextUnit);
  };

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <label className="text-xs text-slate-400">{label}</label>
          {helperText && <p className="mt-1 text-[11px] text-slate-500">{helperText}</p>}
        </div>
        <span className="text-[11px] text-cyan-300">{formatDuration(valueMs)}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          step="any"
          value={displayValue}
          onChange={(event) => commitValue(event.target.value, unit)}
          className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100"
        />
        <select
          value={unit}
          onChange={(event) => handleUnitChange(event.target.value as DurationUnit)}
          className="rounded bg-slate-900 border border-slate-700 px-2 py-2 text-sm text-slate-100"
        >
          {durationUnitOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
