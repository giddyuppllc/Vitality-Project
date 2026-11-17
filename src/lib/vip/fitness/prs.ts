/**
 * Personal-record detection. Pure: given a member's previous bests for an
 * exercise and the sets of one finished workout, which records improved?
 *
 * Record kinds depend on how the exercise is measured:
 *   WEIGHT_REPS → MAX_WEIGHT (heaviest set), EST_1RM (Epley, sets of 1–12
 *                 reps), BEST_SET_VOLUME (weight × reps in one set)
 *   REPS        → MAX_REPS
 *   TIME        → MAX_DURATION
 *
 * A record improves only on a STRICTLY better value. The first time a member
 * logs an exercise sets a baseline (previous = null); the UI calls that a
 * baseline rather than a PR.
 */

export type Measure = 'WEIGHT_REPS' | 'REPS' | 'TIME'
export type PrKind = 'MAX_WEIGHT' | 'EST_1RM' | 'BEST_SET_VOLUME' | 'MAX_REPS' | 'MAX_DURATION'

export const PR_LABEL: Record<PrKind, string> = {
  MAX_WEIGHT: 'Heaviest set',
  EST_1RM: 'Estimated 1-rep max',
  BEST_SET_VOLUME: 'Best set volume',
  MAX_REPS: 'Most reps in a set',
  MAX_DURATION: 'Longest set',
}

export const KINDS_FOR: Record<Measure, PrKind[]> = {
  WEIGHT_REPS: ['MAX_WEIGHT', 'EST_1RM', 'BEST_SET_VOLUME'],
  REPS: ['MAX_REPS'],
  TIME: ['MAX_DURATION'],
}

export interface SetLike {
  id: string
  weightKg: number | null
  reps: number | null
  durationSec: number | null
}

const EPS = 1e-6

/** Epley estimate. One rep is the lift itself; above 12 reps the estimate is unreliable, so it is not used. */
export function estimateOneRepMax(weightKg: number, reps: number): number | null {
  if (!(weightKg > 0) || !(reps >= 1) || reps > 12) return null
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30)
}

/** The value a set scores for a record kind, or null if it doesn't count. */
export function setValue(kind: PrKind, s: SetLike): number | null {
  switch (kind) {
    case 'MAX_WEIGHT':
      return s.weightKg && s.weightKg > 0 && (s.reps ?? 0) >= 1 ? s.weightKg : null
    case 'EST_1RM':
      return s.weightKg && s.reps ? estimateOneRepMax(s.weightKg, s.reps) : null
    case 'BEST_SET_VOLUME':
      return s.weightKg && s.weightKg > 0 && s.reps && s.reps > 0 ? s.weightKg * s.reps : null
    case 'MAX_REPS':
      return s.reps && s.reps > 0 ? s.reps : null
    case 'MAX_DURATION':
      return s.durationSec && s.durationSec > 0 ? s.durationSec : null
  }
}

export interface PrResult {
  kind: PrKind
  value: number
  previous: number | null
  setId: string
}

/** Records that this workout's sets beat (or set for the first time). */
export function detectPrs(measure: Measure, previous: Partial<Record<PrKind, number>>, sets: SetLike[]): PrResult[] {
  const out: PrResult[] = []
  for (const kind of KINDS_FOR[measure]) {
    let best: { value: number; setId: string } | null = null
    for (const s of sets) {
      const v = setValue(kind, s)
      if (v != null && (!best || v > best.value + EPS)) best = { value: v, setId: s.id }
    }
    if (!best) continue
    const prev = previous[kind]
    if (prev == null || best.value > prev + EPS) {
      out.push({ kind, value: best.value, previous: prev ?? null, setId: best.setId })
    }
  }
  return out
}

/** Working volume of a set in kg (weight × reps); 0 for bodyweight/timed sets. */
export function setVolumeKg(s: Pick<SetLike, 'weightKg' | 'reps'>): number {
  return s.weightKg && s.reps ? s.weightKg * s.reps : 0
}
