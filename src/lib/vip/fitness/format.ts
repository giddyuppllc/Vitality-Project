import { fmtDuration, fmtNum, fmtVolume, fromKg, weightUnit, type Units } from './units'
import type { PrKind } from './prs'

/** A personal-record value in the member's units. Pure (server + client). */
export function prValue(kind: PrKind, value: number, units: Units): string {
  if (kind === 'MAX_REPS') return `${fmtNum(value, 0)} reps`
  if (kind === 'MAX_DURATION') return fmtDuration(value)
  if (kind === 'BEST_SET_VOLUME') return fmtVolume(value, units)
  return `${fmtNum(fromKg(value, units))} ${weightUnit(units)}`
}
