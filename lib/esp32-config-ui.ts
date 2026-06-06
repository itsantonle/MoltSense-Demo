import type { Esp32Config } from '@/lib/localStorage';

export type DurationUnit = 'ms' | 's' | 'min' | 'h';

export type WaterPresetId = 'freshwater' | 'tapwater' | 'seawater';

export interface WaterPreset {
  id: WaterPresetId;
  label: string;
  rangeLabel: string;
  description: string;
  conductivityThresholdStart: number;
  conductivityThresholdEnd: number;
  moistureThresholdLow: number;
  moistureThresholdHigh: number;
}

const DURATION_FACTORS: Record<DurationUnit, number> = {
  ms: 1,
  s: 1000,
  min: 60_000,
  h: 3_600_000,
};

export const CONDUCTIVITY_UNIT = 'µS/cm';
export const MOISTURE_UNIT = '%';

export const WATER_PRESETS: WaterPreset[] = [
  {
    id: 'freshwater',
    label: 'Freshwater',
    rangeLabel: '10–2,000 µS/cm',
    description: 'Freshwater profile with molt trigger band 300/200 µS/cm.',
    conductivityThresholdStart: 300,
    conductivityThresholdEnd: 200,
    moistureThresholdLow: 30,
    moistureThresholdHigh: 80,
  },
  {
    id: 'tapwater',
    label: 'Tap Water',
    rangeLabel: '100–800 µS/cm',
    description: 'Tap water profile with the same 300/200 µS/cm trigger band.',
    conductivityThresholdStart: 300,
    conductivityThresholdEnd: 200,
    moistureThresholdLow: 30,
    moistureThresholdHigh: 80,
  },
  {
    id: 'seawater',
    label: 'Seawater',
    rangeLabel: '50,000 µS/cm (50 mS/cm)',
    description: 'Seawater profile with the same 300/200 µS/cm trigger band.',
    conductivityThresholdStart: 300,
    conductivityThresholdEnd: 200,
    moistureThresholdLow: 30,
    moistureThresholdHigh: 80,
  },
];

export const durationUnitOptions: Array<{ label: string; value: DurationUnit }> = [
  { label: 'Milliseconds', value: 'ms' },
  { label: 'Seconds', value: 's' },
  { label: 'Minutes', value: 'min' },
  { label: 'Hours', value: 'h' },
];

export const convertDurationToMs = (value: number, unit: DurationUnit) => {
  return Math.round(value * DURATION_FACTORS[unit]);
};

export const convertMsToDuration = (valueMs: number, unit: DurationUnit) => {
  return valueMs / DURATION_FACTORS[unit];
};

export const chooseDurationUnit = (valueMs: number): DurationUnit => {
  if (valueMs >= DURATION_FACTORS.h && valueMs % DURATION_FACTORS.h === 0) return 'h';
  if (valueMs >= DURATION_FACTORS.min && valueMs % DURATION_FACTORS.min === 0) return 'min';
  if (valueMs >= DURATION_FACTORS.s && valueMs % DURATION_FACTORS.s === 0) return 's';
  return 'ms';
};

export const formatDuration = (valueMs: number) => {
  const unit = chooseDurationUnit(valueMs);
  const value = convertMsToDuration(valueMs, unit);
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(2));
  return `${rounded} ${unit}`;
};

export const formatConductivityWindow = (config: Pick<
  Esp32Config,
  'conductivityThresholdStart' | 'conductivityThresholdEnd'
>) => {
  const trigger = Math.max(config.conductivityThresholdStart, config.conductivityThresholdEnd);
  const reset = Math.min(config.conductivityThresholdStart, config.conductivityThresholdEnd);
  return `Trigger >= ${trigger} ${CONDUCTIVITY_UNIT}, reset <= ${reset} ${CONDUCTIVITY_UNIT}`;
};

export const formatMoistureWindow = (config: Pick<
  Esp32Config,
  'moistureThresholdLow' | 'moistureThresholdHigh'
>) => {
  const low = Math.min(config.moistureThresholdLow, config.moistureThresholdHigh);
  const high = Math.max(config.moistureThresholdLow, config.moistureThresholdHigh);
  return `Normal: ${low}${MOISTURE_UNIT} - ${high}${MOISTURE_UNIT}`;
};

export const applyWaterPreset = (preset: WaterPreset, base?: Partial<Esp32Config>) => ({
  ...(base ?? {}),
  conductivityThresholdStart: preset.conductivityThresholdStart,
  conductivityThresholdEnd: preset.conductivityThresholdEnd,
  moistureThresholdLow: preset.moistureThresholdLow,
  moistureThresholdHigh: preset.moistureThresholdHigh,
});
