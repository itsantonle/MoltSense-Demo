import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type WeightUnit = 'g' | 'kg' | 'lb'
export type TemperatureUnit = 'c' | 'f'

const SENSOR_AREA_M2 = 0.0001
const GRAVITY = 9.80665

export function pressureToWeight(pressurePa: number) {
  const forceN = pressurePa * SENSOR_AREA_M2
  const massKg = forceN / GRAVITY
  return massKg
}

export function formatWeight(pressurePa: number, unit: WeightUnit) {
  const massKg = pressureToWeight(pressurePa)
  if (unit === 'kg') {
    return `${massKg.toFixed(2)} kg`
  }
  if (unit === 'lb') {
    return `${(massKg * 2.20462).toFixed(2)} lb`
  }
  return `${(massKg * 1000).toFixed(0)} g`
}

export function formatTemperature(celsius: number, unit: TemperatureUnit) {
  if (unit === 'f') {
    return `${((celsius * 9) / 5 + 32).toFixed(1)}°F`
  }
  return `${celsius.toFixed(1)}°C`
}
