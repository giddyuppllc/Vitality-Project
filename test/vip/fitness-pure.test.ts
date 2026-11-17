import { describe, expect, it } from 'vitest'
import { addDays, completedSevenDayBlocks, currentStreak, isValidDate, localDate, longestRun } from '@/lib/vip/fitness/dates'
import { detectPrs, estimateOneRepMax } from '@/lib/vip/fitness/prs'
import { fromCm, fromKg, fromMl, toCm, toKg, toMl } from '@/lib/vip/fitness/units'

describe('units', () => {
  it('stores metric and round-trips the member’s imperial numbers exactly', () => {
    for (const lb of [45, 135, 137.5, 225, 315.5]) expect(fromKg(toKg(lb, 'IMPERIAL'), 'IMPERIAL')).toBe(lb)
    expect(fromKg(toKg(100, 'METRIC'), 'METRIC')).toBe(100)
    expect(fromCm(toCm(32.5, 'IMPERIAL'), 'IMPERIAL')).toBe(32.5)
    expect(fromMl(toMl(64, 'IMPERIAL'), 'IMPERIAL')).toBe(64)
    expect(toKg(100, 'IMPERIAL')).toBeCloseTo(45.359, 3)
  })
})

describe('member-local dates', () => {
  // 2026-03-01 03:30 UTC is still Feb 28 in Los Angeles and already Mar 1 in London / Tokyo.
  const instant = new Date('2026-03-01T03:30:00Z')
  it('the same instant is a different calendar day in different zones', () => {
    expect(localDate(instant, 'America/Los_Angeles')).toBe('2026-02-28')
    expect(localDate(instant, 'America/New_York')).toBe('2026-02-28')
    expect(localDate(instant, 'Europe/London')).toBe('2026-03-01')
    expect(localDate(instant, 'Asia/Tokyo')).toBe('2026-03-01')
  })
  it('handles DST changes (no skipped or doubled day)', () => {
    // US spring forward 2026-03-08: 11:30pm local both nights.
    expect(localDate(new Date('2026-03-08T04:30:00Z'), 'America/New_York')).toBe('2026-03-07') // 11:30pm EST
    expect(localDate(new Date('2026-03-09T03:30:00Z'), 'America/New_York')).toBe('2026-03-08') // 11:30pm EDT
  })
  it('calendar arithmetic crosses months, leap days and years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(isValidDate('2026-02-29')).toBe(false)
    expect(isValidDate('2028-02-29')).toBe(true)
  })
})

describe('streaks', () => {
  const run = (start: string, n: number) => Array.from({ length: n }, (_, i) => addDays(start, i))
  it('current streak survives until the end of today, then breaks', () => {
    const set = new Set(run('2026-02-20', 5)) // 20..24
    expect(currentStreak(set, '2026-02-24')).toBe(5) // checked in today
    expect(currentStreak(set, '2026-02-25')).toBe(5) // not yet today — still alive
    expect(currentStreak(set, '2026-02-26')).toBe(0) // missed yesterday
  })
  it('longest run within a range', () => {
    expect(longestRun([...run('2026-01-01', 3), ...run('2026-01-05', 6)])).toBe(6)
    expect(longestRun([...run('2026-01-01', 10)], '2026-01-04', '2026-01-06')).toBe(3)
  })
  it('7-day blocks are keyed by their first day and never shift', () => {
    const set = new Set(run('2026-02-23', 14))
    expect(completedSevenDayBlocks(set, '2026-02-25')).toEqual(['2026-02-23', '2026-03-02'])
    expect(completedSevenDayBlocks(new Set(run('2026-02-23', 6)), '2026-02-28')).toEqual([])
    expect(completedSevenDayBlocks(new Set(run('2026-02-23', 13)), '2026-02-23')).toEqual(['2026-02-23'])
  })
  it('a streak spanning a time-zone boundary counts the member’s days, not UTC days', () => {
    // A member in LA checks in at 9pm local each night = 05:00 UTC the next day.
    const tz = 'America/Los_Angeles'
    const dates = new Set(Array.from({ length: 7 }, (_, i) => localDate(new Date(Date.UTC(2026, 2, 2 + i, 5)), tz)))
    expect([...dates][0]).toBe('2026-03-01')
    expect(currentStreak(dates, localDate(new Date(Date.UTC(2026, 2, 8, 5)), tz))).toBe(7)
    expect(completedSevenDayBlocks(dates, '2026-03-07')).toEqual(['2026-03-01'])
  })
})

describe('personal-record detection', () => {
  const s = (id: string, weightKg: number | null, reps: number | null, durationSec: number | null = null) => ({ id, weightKg, reps, durationSec })
  it('first log is a baseline (previous null) for every kind', () => {
    const prs = detectPrs('WEIGHT_REPS', {}, [s('a', 100, 5), s('b', 105, 3)])
    expect(prs.map((p) => [p.kind, p.setId, p.previous])).toEqual([
      ['MAX_WEIGHT', 'b', null],
      ['EST_1RM', 'a', null], // 100×(1+5/30)=116.7 beats 105×1.1=115.5
      ['BEST_SET_VOLUME', 'a', null],
    ])
  })
  it('only strictly better values are records', () => {
    const prev = { MAX_WEIGHT: 105, EST_1RM: estimateOneRepMax(100, 5)!, BEST_SET_VOLUME: 500 }
    expect(detectPrs('WEIGHT_REPS', prev, [s('x', 105, 2)])).toEqual([])
    const prs = detectPrs('WEIGHT_REPS', prev, [s('y', 107.5, 1), s('z', 100, 6)])
    expect(prs.map((p) => p.kind).sort()).toEqual(['BEST_SET_VOLUME', 'EST_1RM', 'MAX_WEIGHT'])
    expect(prs.find((p) => p.kind === 'MAX_WEIGHT')?.previous).toBe(105)
  })
  it('bodyweight reps and timed sets', () => {
    expect(detectPrs('REPS', { MAX_REPS: 10 }, [s('a', null, 10), s('b', null, 12)])).toMatchObject([{ kind: 'MAX_REPS', value: 12, previous: 10 }])
    expect(detectPrs('TIME', { MAX_DURATION: 60 }, [s('a', null, null, 59)])).toEqual([])
    expect(detectPrs('TIME', { MAX_DURATION: 60 }, [s('a', null, null, 75)])).toMatchObject([{ kind: 'MAX_DURATION', value: 75 }])
  })
  it('e1RM ignores sets over 12 reps', () => {
    expect(estimateOneRepMax(50, 20)).toBeNull()
    expect(estimateOneRepMax(100, 1)).toBe(100)
  })
})
