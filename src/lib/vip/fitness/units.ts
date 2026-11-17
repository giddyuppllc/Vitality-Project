/**
 * Units. Everything is STORED metric (kg, cm, ml) and converted at the edge
 * for the member's preference (imperial by default). Pure functions only —
 * shared by server pages, API routes and client components.
 */

export type Units = 'IMPERIAL' | 'METRIC'

export const KG_PER_LB = 0.45359237
export const CM_PER_IN = 2.54
export const ML_PER_FLOZ = 29.5735295625

const round = (n: number, dp: number) => {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

export const weightUnit = (u: Units) => (u === 'METRIC' ? 'kg' : 'lb')
export const lengthUnit = (u: Units) => (u === 'METRIC' ? 'cm' : 'in')
export const waterUnit = (u: Units) => (u === 'METRIC' ? 'ml' : 'oz')

/** Member-entered weight → kg (stored). */
export function toKg(value: number, u: Units): number {
  return u === 'METRIC' ? value : value * KG_PER_LB
}
/** Stored kg → the member's unit, rounded to 0.1. */
export function fromKg(kg: number, u: Units): number {
  return round(u === 'METRIC' ? kg : kg / KG_PER_LB, 1)
}

export function toCm(value: number, u: Units): number {
  return u === 'METRIC' ? value : value * CM_PER_IN
}
export function fromCm(cm: number, u: Units): number {
  return round(u === 'METRIC' ? cm : cm / CM_PER_IN, 1)
}

export function toMl(value: number, u: Units): number {
  return Math.round(u === 'METRIC' ? value : value * ML_PER_FLOZ)
}
export function fromMl(ml: number, u: Units): number {
  return u === 'METRIC' ? Math.round(ml) : round(ml / ML_PER_FLOZ, 0)
}

/** "1,234" style, no trailing ".0". */
export function fmtNum(n: number, maxDp = 1): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: maxDp })
}

export function fmtWeight(kg: number | null | undefined, u: Units): string {
  if (kg == null) return '—'
  return `${fmtNum(fromKg(kg, u))} ${weightUnit(u)}`
}

/** Big totals (session volume) — whole numbers. */
export function fmtVolume(kg: number, u: Units): string {
  return `${fmtNum(Math.round(fromKg(kg, u)), 0)} ${weightUnit(u)}`
}

export function fmtDuration(sec: number | null | undefined): string {
  if (sec == null) return '—'
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m) return r ? `${m}:${String(r).padStart(2, '0')}` : `${m} min`
  return `${r}s`
}

/** mm:ss for timers. */
export function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
