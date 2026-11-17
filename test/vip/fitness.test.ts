import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import sharp from 'sharp'
import { existsSync } from 'node:fs'
import { readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '@/lib/prisma'
import { pointsBalance } from '@/lib/vip/points'
import { makeUser, params, req, setSession } from '../helpers'
import * as prefsApi from '@/app/api/vip/fitness/prefs/route'
import * as programsApi from '@/app/api/vip/fitness/programs/[id]/route'
import * as workoutsApi from '@/app/api/vip/fitness/workouts/route'
import * as workoutApi from '@/app/api/vip/fitness/workouts/[id]/route'
import * as setsApi from '@/app/api/vip/fitness/workouts/[id]/sets/route'
import * as setApi from '@/app/api/vip/fitness/workouts/[id]/sets/[setId]/route'
import * as finishApi from '@/app/api/vip/fitness/workouts/[id]/finish/route'
import * as checkinsApi from '@/app/api/vip/fitness/checkins/route'
import * as metricsApi from '@/app/api/vip/fitness/metrics/route'
import * as metricApi from '@/app/api/vip/fitness/metrics/[id]/route'
import * as photosApi from '@/app/api/vip/fitness/photos/route'
import * as photoApi from '@/app/api/vip/fitness/photos/[id]/route'
import * as challengeApi from '@/app/api/vip/fitness/challenges/[id]/route'
import * as exercisesApi from '@/app/api/vip/fitness/exercises/route'
import * as adminExercises from '@/app/api/admin/vip/fitness/exercises/route'
import * as adminPrograms from '@/app/api/admin/vip/fitness/programs/route'
import * as adminChallenges from '@/app/api/admin/vip/fitness/challenges/route'
import * as adminArticles from '@/app/api/admin/vip/fitness/articles/route'
import * as adminSettings from '@/app/api/admin/vip/fitness/settings/route'
import { getProgram } from '@/lib/vip/fitness/programs'
import { getArticle } from '@/lib/vip/fitness/articles'
import { finishWorkout, startWorkout, addSet } from '@/lib/vip/fitness/workouts'
import { saveCheckin } from '@/lib/vip/fitness/health'
import { leaderboard } from '@/lib/vip/fitness/challenges'
import { localDate } from '@/lib/vip/fitness/dates'

type H = (r: NextRequest, c: { params: Promise<Record<string, unknown>> }) => Promise<Response>
const call = async (fn: unknown, r: NextRequest, p: Record<string, unknown> = {}) => {
  const res = await (fn as H)(r, params(p))
  return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, any> }
}
const admin = { u: null as unknown as Awaited<ReturnType<typeof makeUser>> }
const adminPost = async (fn: unknown, url: string, body: Record<string, unknown>) => {
  setSession({ ...admin.u, role: 'ADMIN' })
  const r = await call(fn, req(url, { body }))
  expect(r.status, JSON.stringify(r.body)).toBe(200)
  return r.body.id as string
}

let club: Awaited<ReturnType<typeof makeUser>>
let plus: Awaited<ReturnType<typeof makeUser>>
let plus2: Awaited<ReturnType<typeof makeUser>>
let premium: Awaited<ReturnType<typeof makeUser>>
let outsider: Awaited<ReturnType<typeof makeUser>>
let lapsed: Awaited<ReturnType<typeof makeUser>>
const ids = {} as Record<string, string>
const today = () => localDate(new Date(), 'America/New_York')

beforeAll(async () => {
  admin.u = await makeUser({ tag: 'fit-admin', role: 'ADMIN' })
  club = await makeUser({ tag: 'fit-club', tier: 'CLUB' })
  plus = await makeUser({ tag: 'fit-plus', tier: 'PLUS' })
  plus2 = await makeUser({ tag: 'fit-plus2', tier: 'PLUS' })
  premium = await makeUser({ tag: 'fit-premium', tier: 'PREMIUM' })
  outsider = await makeUser({ tag: 'fit-outsider' })
  lapsed = await makeUser({ tag: 'fit-lapsed', tier: 'PLUS', status: 'PAST_DUE' })

  const stamp = Date.now().toString(36)
  const ex = (name: string, measure: string) =>
    adminPost(adminExercises.POST, '/api/admin/vip/fitness/exercises', {
      op: 'exercise.upsert', name: `ZZ ${name} ${stamp}`, muscleGroups: ['quads', ' Glutes '], equipment: ['barbell'], measure, instructions: 'placeholder', published: true,
    })
  ids.squat = await ex('Squat', 'WEIGHT_REPS')
  ids.plank = await ex('Plank', 'TIME')
  ids.pushup = await ex('Pushup', 'REPS')

  const program = (title: string, minTier: string) =>
    adminPost(adminPrograms.POST, '/api/admin/vip/fitness/programs', { op: 'program.upsert', title: `${title} ${stamp}`, minTier, published: true })
  ids.plusProgram = await program('ZZ Plus Program', 'PLUS')
  ids.premiumProgram = await program('ZZ Premium Program', 'PREMIUM')
  for (const pid of [ids.plusProgram, ids.premiumProgram]) {
    const week = await adminPost(adminPrograms.POST, '/api/admin/vip/fitness/programs', { op: 'week.upsert', programId: pid })
    const day1 = await adminPost(adminPrograms.POST, '/api/admin/vip/fitness/programs', { op: 'day.upsert', weekId: week, title: 'ZZ Day 1' })
    const rest = await adminPost(adminPrograms.POST, '/api/admin/vip/fitness/programs', { op: 'day.upsert', weekId: week, title: 'ZZ Rest', isRest: true })
    const wk = await adminPost(adminPrograms.POST, '/api/admin/vip/fitness/programs', { op: 'workout.upsert', dayId: day1, title: 'ZZ Main' })
    await adminPost(adminPrograms.POST, '/api/admin/vip/fitness/programs', { op: 'prescription.upsert', workoutId: wk, exerciseId: ids.squat, sets: 3, reps: '5', restSec: 120 })
    await adminPost(adminPrograms.POST, '/api/admin/vip/fitness/programs', { op: 'prescription.upsert', workoutId: wk, exerciseId: ids.plank, sets: 2, durationSec: 45 })
    ids[`${pid}:day1`] = day1
    ids[`${pid}:rest`] = rest
  }
})

afterAll(async () => {
  // Remove any progress photos the tests wrote (private-uploads is gitignored anyway).
  for (const u of [club, plus, plus2, premium]) {
    await rm(path.join(process.cwd(), 'private-uploads', 'vip-progress', u.id), { recursive: true, force: true })
  }
})

describe('authorization', () => {
  it('signed-out → 401, non-member → 403, lapsed member → 403 on every fitness API', async () => {
    const probes: [unknown, string, Record<string, unknown>, Record<string, unknown>?][] = [
      [prefsApi.GET, '/api/vip/fitness/prefs', {}],
      [workoutsApi.POST, '/api/vip/fitness/workouts', {}, { title: 'x' }],
      [checkinsApi.PUT, '/api/vip/fitness/checkins', {}, { water: 1 }],
      [metricsApi.GET, '/api/vip/fitness/metrics', {}],
      [photosApi.GET, '/api/vip/fitness/photos', {}],
      [exercisesApi.GET, '/api/vip/fitness/exercises', {}],
      [programsApi.POST, `/api/vip/fitness/programs/${ids.plusProgram}`, { id: ids.plusProgram }, { action: 'enroll' }],
    ]
    for (const [who, expected] of [[null, 401], [outsider, 403], [lapsed, 403]] as const) {
      setSession(who)
      for (const [fn, url, p, body] of probes) {
        const method = fn === checkinsApi.PUT ? 'PUT' : body ? 'POST' : 'GET'
        expect((await call(fn, req(url, { method, body }), p)).status, `${url} as ${who?.email ?? 'anon'}`).toBe(expected)
      }
    }
  })

  it('admin APIs refuse members and anonymous callers', async () => {
    for (const who of [null, premium]) {
      setSession(who)
      for (const [fn, url] of [
        [adminExercises.POST, '/api/admin/vip/fitness/exercises'],
        [adminPrograms.POST, '/api/admin/vip/fitness/programs'],
        [adminChallenges.POST, '/api/admin/vip/fitness/challenges'],
        [adminArticles.POST, '/api/admin/vip/fitness/articles'],
      ] as const) {
        expect((await call(fn, req(url, { body: { op: 'exercise.delete', id: ids.squat } }))).status).toBe(401)
      }
      expect((await call(adminSettings.PUT, req('/api/admin/vip/fitness/settings', { method: 'PUT', body: { 'vip.fitness.points.workout': 1 } }))).status).toBe(401)
    }
  })

  it('admin writes are audit-logged; tags are normalised', async () => {
    const log = await prisma.auditLog.findFirst({ where: { action: 'vip.fitness.exercise.upsert', entityId: ids.squat } })
    expect(log?.userId).toBe(admin.u.id)
    const ex = await prisma.vipExercise.findUniqueOrThrow({ where: { id: ids.squat } })
    expect(ex.muscleGroups).toEqual(['Quads', 'Glutes'])
    expect(ex.equipment).toEqual(['Barbell'])
  })

  it('wrong tier: program outline only, no enroll, no start; article body withheld', async () => {
    const slug = (await prisma.vipProgram.findUniqueOrThrow({ where: { id: ids.premiumProgram } })).slug
    const g = await getProgram(slug, plus.id, 'PLUS')
    expect(g?.allowed).toBe(false)
    expect(g!.program.weeks[0].days.every((d) => d.workouts.length === 0)).toBe(true)
    setSession(plus)
    expect((await call(programsApi.POST, req(`/api/vip/fitness/programs/${ids.premiumProgram}`, { body: { action: 'enroll' } }), { id: ids.premiumProgram })).status).toBe(403)
    expect((await call(workoutsApi.POST, req('/api/vip/fitness/workouts', { body: { programDayId: ids[`${ids.premiumProgram}:day1`] } }))).status).toBe(403)
    // ... while Premium can.
    const gp = await getProgram(slug, premium.id, 'PREMIUM')
    expect(gp!.program.weeks[0].days[0].workouts[0].prescriptions).toHaveLength(2)

    const art = await adminPost(adminArticles.POST, '/api/admin/vip/fitness/articles', {
      op: 'article.upsert', title: `ZZ Premium guide ${Date.now()}`, body: 'ZZ secret body', category: 'SLEEP', minTier: 'PREMIUM', published: true,
    })
    const aslug = (await prisma.vipArticle.findUniqueOrThrow({ where: { id: art } })).slug
    const locked = await getArticle(aslug, 'CLUB')
    expect(locked?.allowed).toBe(false)
    expect(locked?.article.body).toBe('')
    expect((await getArticle(aslug, 'PREMIUM'))?.article.body).toBe('ZZ secret body')
  })
})

describe('workout logger, PRs and points', () => {
  it('logs, detects PRs (baseline then improvement), awards 25 once per day, finish is idempotent', async () => {
    setSession(club)
    const before = await pointsBalance(club.id)
    const start = await call(workoutsApi.POST, req('/api/vip/fitness/workouts', { body: { title: 'ZZ Legs', tz: 'America/New_York' } }))
    expect(start.status).toBe(201)
    const w1 = start.body.id
    // A second start while one is open → 409 with its id.
    const again = await call(workoutsApi.POST, req('/api/vip/fitness/workouts', { body: {} }))
    expect(again.status).toBe(409)
    expect(again.body.openId).toBe(w1)

    const add = (id: string, body: Record<string, unknown>) => call(setsApi.POST, req(`/api/vip/fitness/workouts/${id}/sets`, { body }), { id })
    expect((await add(w1, { exerciseId: ids.squat, weight: 135, units: 'IMPERIAL', reps: 5 })).status).toBe(201)
    const s2 = await add(w1, { exerciseId: ids.squat, weight: 155, units: 'IMPERIAL', reps: 3, rpe: 8.5 })
    expect(s2.body.set.weightKg).toBeCloseTo(155 * 0.45359237, 3)
    expect((await add(w1, { exerciseId: ids.squat, weight: 100, units: 'IMPERIAL' })).status).toBe(400) // reps required
    expect((await add(w1, { exerciseId: ids.plank, durationSec: 60 })).status).toBe(201)

    const f1 = await call(finishApi.POST, req(`/api/vip/fitness/workouts/${w1}/finish`, { body: { tz: 'America/New_York' } }), { id: w1 })
    expect(f1.status).toBe(200)
    expect(f1.body.pointsAwarded).toBe(25)
    expect(f1.body.prs.every((p: { previous: number | null }) => p.previous === null)).toBe(true)
    expect(f1.body.prs.map((p: { kind: string }) => p.kind).sort()).toEqual(['BEST_SET_VOLUME', 'EST_1RM', 'MAX_DURATION', 'MAX_WEIGHT'])
    const f1b = await call(finishApi.POST, req(`/api/vip/fitness/workouts/${w1}/finish`, { body: {} }), { id: w1 })
    expect(f1b.body.pointsAwarded).toBe(25)
    expect(await pointsBalance(club.id)).toBe(before + 25)
    // Sets of a finished workout can't change.
    expect((await add(w1, { exerciseId: ids.squat, weight: 500, units: 'IMPERIAL', reps: 1 })).status).toBe(409)

    // Same day, heavier: new PR, no second workout award.
    const w2 = (await call(workoutsApi.POST, req('/api/vip/fitness/workouts', { body: { title: 'ZZ Legs 2' } }))).body.id
    await add(w2, { exerciseId: ids.squat, weight: 160, units: 'IMPERIAL', reps: 3 })
    const f2 = await call(finishApi.POST, req(`/api/vip/fitness/workouts/${w2}/finish`, { body: {} }), { id: w2 })
    expect(f2.body.pointsAwarded).toBe(0)
    const mw = f2.body.prs.find((p: { kind: string }) => p.kind === 'MAX_WEIGHT')
    expect(mw.previous).toBeCloseTo(155 * 0.45359237, 3)
    expect(f2.body.prs.find((p: { kind: string }) => p.kind === 'BEST_SET_VOLUME')).toBeUndefined() // 160×3 < 135×5
    expect(await pointsBalance(club.id)).toBe(before + 25)
    expect(await prisma.loyaltyTransaction.count({ where: { idempotencyKey: { startsWith: `workout-day:${club.id}:` } } })).toBe(1)

    // Deleting the PR workout rebuilds the record from what remains.
    setSession(club)
    expect((await call(workoutApi.DELETE, req(`/api/vip/fitness/workouts/${w2}`, { method: 'DELETE' }), { id: w2 })).status).toBe(200)
    const rec = await prisma.vipPersonalRecord.findUniqueOrThrow({ where: { userId_exerciseId_kind: { userId: club.id, exerciseId: ids.squat, kind: 'MAX_WEIGHT' } } })
    expect(rec.value).toBeCloseTo(155 * 0.45359237, 3)
  })

  it("someone else's workout is a 404 for every operation", async () => {
    setSession(plus)
    const mine = (await call(workoutsApi.POST, req('/api/vip/fitness/workouts', { body: { title: 'ZZ private' } }))).body.id
    const s = (await call(setsApi.POST, req(`/api/vip/fitness/workouts/${mine}/sets`, { body: { exerciseId: ids.pushup, reps: 10 } }), { id: mine })).body.set
    setSession(plus2)
    expect((await call(workoutApi.GET, req(`/api/vip/fitness/workouts/${mine}`), { id: mine })).status).toBe(404)
    expect((await call(workoutApi.PATCH, req(`/api/vip/fitness/workouts/${mine}`, { method: 'PATCH', body: { title: 'hijack' } }), { id: mine })).status).toBe(404)
    expect((await call(setsApi.POST, req(`/api/vip/fitness/workouts/${mine}/sets`, { body: { exerciseId: ids.pushup, reps: 1 } }), { id: mine })).status).toBe(404)
    expect((await call(setApi.PATCH, req(`/api/vip/fitness/workouts/${mine}/sets/${s.id}`, { method: 'PATCH', body: { reps: 99 } }), { id: mine, setId: s.id })).status).toBe(404)
    expect((await call(setApi.DELETE, req(`/api/vip/fitness/workouts/${mine}/sets/${s.id}`, { method: 'DELETE' }), { id: mine, setId: s.id })).status).toBe(404)
    expect((await call(finishApi.POST, req(`/api/vip/fitness/workouts/${mine}/finish`, { body: {} }), { id: mine })).status).toBe(404)
    expect((await call(workoutApi.DELETE, req(`/api/vip/fitness/workouts/${mine}`, { method: 'DELETE' }), { id: mine })).status).toBe(404)
    // A set id from another workout can't be edited through your own workout either.
    const theirs = (await call(workoutsApi.POST, req('/api/vip/fitness/workouts', { body: {} }))).body.id
    expect((await call(setApi.PATCH, req(`/api/vip/fitness/workouts/${theirs}/sets/${s.id}`, { method: 'PATCH', body: { reps: 99 } }), { id: theirs, setId: s.id })).status).toBe(404)
    expect((await prisma.vipWorkoutSet.findUniqueOrThrow({ where: { id: s.id } })).reps).toBe(10)
    await prisma.vipWorkoutLog.deleteMany({ where: { id: { in: [mine, theirs] } } })
  })

  it('program: enroll, rest day, finish the day → program complete, 500 points once even after a restart', async () => {
    setSession(plus)
    const pid = ids.plusProgram
    expect((await call(programsApi.POST, req(`/api/vip/fitness/programs/${pid}`, { body: { action: 'enroll' } }), { id: pid })).status).toBe(200)
    // Rest day only through rest-day; a training day can't be skipped that way.
    expect((await call(programsApi.POST, req(`/api/vip/fitness/programs/${pid}`, { body: { action: 'rest-day', dayId: ids[`${pid}:day1`] } }), { id: pid })).status).toBe(400)
    expect((await call(programsApi.POST, req(`/api/vip/fitness/programs/${pid}`, { body: { action: 'rest-day', dayId: ids[`${pid}:rest`] } }), { id: pid })).body.programCompleted).toBe(false)

    const before = await pointsBalance(plus.id)
    const w = (await call(workoutsApi.POST, req('/api/vip/fitness/workouts', { body: { programDayId: ids[`${pid}:day1`] } }))).body.id
    const logger = await call(workoutApi.GET, req(`/api/vip/fitness/workouts/${w}`), { id: w })
    expect(logger.body.blocks.map((b: { exercise: { id: string } }) => b.exercise.id)).toEqual([ids.squat, ids.plank])
    expect(logger.body.blocks[0].plan[0]).toMatchObject({ sets: 3, reps: '5', restSec: 120 })
    await call(setsApi.POST, req(`/api/vip/fitness/workouts/${w}/sets`, { body: { exerciseId: ids.squat, weight: 60, units: 'METRIC', reps: 5 } }), { id: w })
    const f = await call(finishApi.POST, req(`/api/vip/fitness/workouts/${w}/finish`, { body: {} }), { id: w })
    expect(f.body.programCompleted).toBe(true)
    expect(f.body.programPoints).toBe(500)
    expect(await pointsBalance(plus.id)).toBe(before + 500 + 25)
    expect((await prisma.vipProgramEnrollment.findUniqueOrThrow({ where: { userId_programId: { userId: plus.id, programId: pid } } })).status).toBe('COMPLETED')

    // Restart and complete again: no second program award.
    await call(programsApi.POST, req(`/api/vip/fitness/programs/${pid}`, { body: { action: 'restart' } }), { id: pid })
    await call(programsApi.POST, req(`/api/vip/fitness/programs/${pid}`, { body: { action: 'rest-day', dayId: ids[`${pid}:rest`] } }), { id: pid })
    const w2 = (await call(workoutsApi.POST, req('/api/vip/fitness/workouts', { body: { programDayId: ids[`${pid}:day1`] } }))).body.id
    await call(setsApi.POST, req(`/api/vip/fitness/workouts/${w2}/sets`, { body: { exerciseId: ids.plank, durationSec: 30 } }), { id: w2 })
    const f2 = await call(finishApi.POST, req(`/api/vip/fitness/workouts/${w2}/finish`, { body: {} }), { id: w2 })
    expect(f2.body.programCompleted).toBe(true)
    expect(f2.body.programPoints).toBe(0)
    expect(await pointsBalance(plus.id)).toBe(before + 525)
  })
})

describe('health tracking (private)', () => {
  it('check-in: 5 points once per local day; 7 in a row → 100 once; dates follow the member’s zone', async () => {
    const u = await makeUser({ tag: 'fit-streak', tier: 'CLUB' })
    const tz = 'America/Los_Angeles'
    // 9:30pm in LA = 05:30 UTC the next day. Seven nights, Mar 1..Mar 7 local.
    const nights = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 2, 2 + i, 5, 30)))
    let last
    for (const at of nights) last = await saveCheckin(u.id, tz, 'today', { steps: 5000, mood: 4 }, at)
    expect(last!.date).toBe('2026-03-07')
    expect(last!.streak).toBe(7)
    expect(last!.streakBonus).toBe(100)
    const rows = await prisma.vipCheckin.findMany({ where: { userId: u.id }, orderBy: { date: 'asc' } })
    expect(rows.map((r) => r.date)).toEqual(['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07'])
    // Editing the same day again pays nothing more.
    const again = await saveCheckin(u.id, tz, 'today', { steps: 9000 }, nights[6])
    expect(again.points).toBe(0)
    expect(again.streakBonus).toBe(0)
    expect(await pointsBalance(u.id)).toBe(7 * 5 + 100)
    expect(await prisma.loyaltyTransaction.findFirst({ where: { idempotencyKey: `streak7:${u.id}:2026-03-01` } })).not.toBeNull()
    // In UTC those same instants were Mar 2..Mar 8 — the member's calendar wins.
    expect(rows.some((r) => r.date === '2026-03-08')).toBe(false)
  })

  it('yesterday can be filled in; the API stores water in ml from oz', async () => {
    setSession(premium)
    const r = await call(checkinsApi.PUT, req('/api/vip/fitness/checkins', { method: 'PUT', body: { day: 'yesterday', tz: 'Europe/London', units: 'IMPERIAL', water: 64, sleepHours: 7.5 } }))
    expect(r.status).toBe(200)
    const row = await prisma.vipCheckin.findFirstOrThrow({ where: { userId: premium.id, date: r.body.date } })
    expect(row.waterMl).toBe(1893)
    expect((await prisma.vipFitnessProfile.findUniqueOrThrow({ where: { userId: premium.id } })).timeZone).toBe('Europe/London')
    expect((await call(checkinsApi.PUT, req('/api/vip/fitness/checkins', { method: 'PUT', body: { day: 'last-week' } }))).status).toBe(400)
  })

  it("body metrics and photos are private: other members and admins get 404", async () => {
    setSession(plus)
    const put = await call(metricsApi.PUT, req('/api/vip/fitness/metrics', { method: 'PUT', body: { date: '2026-01-05', tz: 'America/New_York', units: 'IMPERIAL', weight: 180, waist: 34 } }))
    expect(put.status).toBe(200)
    const m = await prisma.vipBodyMetric.findUniqueOrThrow({ where: { id: put.body.id } })
    expect(m.weightKg).toBeCloseTo(81.65, 2)
    expect(m.waistCm).toBeCloseTo(86.36, 2)

    const png = await sharp({ create: { width: 24, height: 32, channels: 3, background: { r: 30, g: 60, b: 90 } } }).png().toBuffer()
    const fd = new FormData()
    fd.set('file', new File([new Uint8Array(png)], 'me.png', { type: 'image/png' }))
    fd.set('pose', 'front')
    const up = await (photosApi.POST as unknown as (r: NextRequest) => Promise<Response>)(
      new NextRequest(new URL('/api/vip/fitness/photos', 'http://vitalityproject.vip'), { method: 'POST', body: fd, headers: { 'x-forwarded-for': '10.9.9.9' } }),
    )
    expect(up.status).toBe(201)
    const photoId = (await up.json()).id as string
    const row = await prisma.vipProgressPhoto.findUniqueOrThrow({ where: { id: photoId } })
    // Own folder, never the shared member-media folder or public/.
    expect(row.fileKey.startsWith(`${plus.id}/`)).toBe(true)
    const dir = path.join(process.cwd(), 'private-uploads', 'vip-progress', plus.id)
    expect((await readdir(dir)).length).toBe(1)
    expect(existsSync(path.join(process.cwd(), 'public', 'uploads', path.basename(row.fileKey) + '.jpg'))).toBe(false)

    const own = await (photoApi.GET as unknown as H)(req(`/api/vip/fitness/photos/${photoId}`), params({ id: photoId }))
    expect(own.status).toBe(200)
    expect(own.headers.get('content-type')).toBe('image/jpeg')
    expect(own.headers.get('cache-control')).toContain('no-store')

    for (const who of [plus2, { ...admin.u, role: 'ADMIN' }]) {
      setSession(who)
      expect((await call(photoApi.GET, req(`/api/vip/fitness/photos/${photoId}`), { id: photoId })).status).toBe(404)
      expect((await call(photoApi.DELETE, req(`/api/vip/fitness/photos/${photoId}`, { method: 'DELETE' }), { id: photoId })).status).toBe(404)
      expect((await call(metricApi.DELETE, req(`/api/vip/fitness/metrics/${m.id}`, { method: 'DELETE' }), { id: m.id })).status).toBe(404)
      const list = await call(metricsApi.GET, req('/api/vip/fitness/metrics'))
      expect((list.body?.metrics ?? []).some((x: { id: string }) => x.id === m.id)).toBe(false)
      const photos = await call(photosApi.GET, req('/api/vip/fitness/photos'))
      expect((photos.body?.photos ?? []).some((x: { id: string }) => x.id === photoId)).toBe(false)
    }
    setSession(null)
    expect((await call(photoApi.GET, req(`/api/vip/fitness/photos/${photoId}`), { id: photoId })).status).toBe(401)

    setSession(plus)
    expect((await call(photoApi.DELETE, req(`/api/vip/fitness/photos/${photoId}`, { method: 'DELETE' }), { id: photoId })).status).toBe(200)
    expect((await readdir(dir)).length).toBe(0)
    expect((await call(metricApi.DELETE, req(`/api/vip/fitness/metrics/${m.id}`, { method: 'DELETE' }), { id: m.id })).status).toBe(200)
  })
})

describe('challenges', () => {
  it('leaderboard ranks by score; hidden members vanish for others but not for themselves or admins; completion pays once', async () => {
    const d = today()
    const cid = await adminPost(adminChallenges.POST, '/api/admin/vip/fitness/challenges', {
      op: 'challenge.upsert', title: `ZZ Steps ${Date.now()}`, metric: 'STEPS', target: 15000, startDate: d, endDate: d, minTier: 'CLUB', pointsReward: 300, badgeLabel: 'ZZ Stepper', published: true,
    })
    const a = await makeUser({ tag: 'fit-ch-a', tier: 'CLUB' })
    const b = await makeUser({ tag: 'fit-ch-b', tier: 'CLUB' })
    const hidden = await makeUser({ tag: 'fit-ch-hidden', tier: 'CLUB' })
    for (const u of [a, b, hidden]) {
      setSession(u)
      expect((await call(challengeApi.POST, req(`/api/vip/fitness/challenges/${cid}`, { body: { action: 'join' } }), { id: cid })).status).toBe(200)
      await call(prefsApi.PATCH, req('/api/vip/fitness/prefs', { method: 'PATCH', body: { tz: 'America/New_York', ...(u === hidden ? { hideFromLeaderboards: true } : {}) } }))
    }
    setSession(a)
    await call(checkinsApi.PUT, req('/api/vip/fitness/checkins', { method: 'PUT', body: { steps: 9000, tz: 'America/New_York' } }))
    setSession(hidden)
    await call(checkinsApi.PUT, req('/api/vip/fitness/checkins', { method: 'PUT', body: { steps: 12000, tz: 'America/New_York' } }))
    setSession(b)
    const r = await call(checkinsApi.PUT, req('/api/vip/fitness/checkins', { method: 'PUT', body: { steps: 16000, tz: 'America/New_York' } }))
    expect(r.body.challengesCompleted).toEqual([{ title: expect.stringContaining('ZZ Steps'), points: 300 }])

    // What member A sees: B first, A second, the hidden member absent.
    setSession(a)
    const seen = await call(challengeApi.GET, req(`/api/vip/fitness/challenges/${cid}`), { id: cid })
    expect(seen.body.leaderboard.map((x: { name: string; rank: number }) => [x.name, x.rank])).toEqual([
      ['ZZ fit-ch-b', 1],
      ['ZZ fit-ch-a', 2],
    ])
    expect(JSON.stringify(seen.body)).not.toContain(hidden.id)
    expect(JSON.stringify(seen.body)).not.toContain('fit-ch-hidden')
    // The hidden member still sees themself.
    const own = await leaderboard(cid, { viewerId: hidden.id })
    expect(own.find((x) => x.isViewer)).toMatchObject({ score: 12000, hidden: true, rank: 2 })
    // Admins see everyone, flagged.
    const all = await leaderboard(cid, { all: true })
    expect(all.map((x) => x.score)).toEqual([16000, 12000, 9000])
    expect(all.find((x) => x.userId === hidden.id)?.hidden).toBe(true)

    // Exactly-once badge + points, even if re-evaluated.
    await adminPost(adminChallenges.POST, '/api/admin/vip/fitness/challenges', { op: 'challenge.evaluate', id: cid })
    setSession(b)
    await call(checkinsApi.PUT, req('/api/vip/fitness/checkins', { method: 'PUT', body: { steps: 20000, tz: 'America/New_York' } }))
    expect(await prisma.vipUserBadge.count({ where: { userId: b.id } })).toBe(1)
    expect((await prisma.vipUserBadge.findFirstOrThrow({ where: { userId: b.id } })).label).toBe('ZZ Stepper')
    expect(await prisma.loyaltyTransaction.count({ where: { idempotencyKey: `challenge:${b.id}:${cid}` } })).toBe(1)
    expect(await pointsBalance(b.id)).toBe(300 + 5)
    // A completed challenge can't be left.
    expect((await call(challengeApi.POST, req(`/api/vip/fitness/challenges/${cid}`, { body: { action: 'leave' } }), { id: cid })).status).toBe(409)
  })

  it('coach-scored challenges, tier gating and unpublished challenges', async () => {
    const d = today()
    const cid = await adminPost(adminChallenges.POST, '/api/admin/vip/fitness/challenges', {
      op: 'challenge.upsert', title: `ZZ Coach ${Date.now()}`, metric: 'CUSTOM_POINTS', target: 10, startDate: d, endDate: d, minTier: 'PLUS', pointsReward: 50, published: true,
    })
    setSession(club)
    expect((await call(challengeApi.POST, req(`/api/vip/fitness/challenges/${cid}`, { body: { action: 'join' } }), { id: cid })).status).toBe(403)
    setSession(premium)
    expect((await call(challengeApi.POST, req(`/api/vip/fitness/challenges/${cid}`, { body: { action: 'join' } }), { id: cid })).status).toBe(200)
    setSession({ ...admin.u, role: 'ADMIN' })
    const scored = await call(adminChallenges.POST, req('/api/admin/vip/fitness/challenges', { body: { op: 'participant.score', challengeId: cid, userId: premium.id, score: 12 } }))
    expect(scored.body.completed).toBe(1)
    expect(await prisma.loyaltyTransaction.count({ where: { idempotencyKey: `challenge:${premium.id}:${cid}` } })).toBe(1)
    // The metric can't change once members have joined.
    expect((await call(adminChallenges.POST, req('/api/admin/vip/fitness/challenges', { body: { op: 'challenge.upsert', id: cid, title: 'x', metric: 'STEPS', target: 1, startDate: d, endDate: d, minTier: 'PLUS', pointsReward: 0, published: true } }))).status).toBe(409)

    const draft = await adminPost(adminChallenges.POST, '/api/admin/vip/fitness/challenges', {
      op: 'challenge.upsert', title: `ZZ Draft ${Date.now()}`, metric: 'WORKOUTS', target: 1, startDate: d, endDate: d, minTier: 'CLUB', pointsReward: 0, published: false,
    })
    setSession(club)
    expect((await call(challengeApi.POST, req(`/api/vip/fitness/challenges/${draft}`, { body: { action: 'join' } }), { id: draft })).status).toBe(404)
    expect((await call(challengeApi.GET, req(`/api/vip/fitness/challenges/${draft}`), { id: draft })).status).toBe(404)
  })
})

describe('admin-configurable points', () => {
  it('0 turns an award off; amounts come from settings', async () => {
    setSession({ ...admin.u, role: 'ADMIN' })
    const put = await call(adminSettings.PUT, req('/api/admin/vip/fitness/settings', { method: 'PUT', body: { 'vip.fitness.points.workout': 0, 'vip.fitness.points.checkin': 7 } }))
    expect(put.body['vip.fitness.points.workout']).toBe(0)
    const u = await makeUser({ tag: 'fit-settings', tier: 'CLUB' })
    const w = await startWorkout(u.id, 'CLUB', { title: 'ZZ' })
    await addSet(u.id, w.id, ids.pushup, { reps: 10 })
    expect((await finishWorkout(u.id, w.id, 'UTC')).pointsAwarded).toBe(0)
    expect((await saveCheckin(u.id, 'UTC', 'today', { mood: 3 })).points).toBe(7)
    expect(await pointsBalance(u.id)).toBe(7)
    expect(await prisma.auditLog.count({ where: { action: 'vip.fitness.settings.update' } })).toBeGreaterThan(0)
    await call(adminSettings.PUT, req('/api/admin/vip/fitness/settings', { method: 'PUT', body: { 'vip.fitness.points.workout': 25, 'vip.fitness.points.checkin': 5 } }))
  })
})

describe('starter exercises seed + content guard', () => {
  it('is insert-only: never touches an existing exercise, second run creates nothing', async () => {
    const { seedFitnessExercises } = await import('../../scripts/vip/seed-fitness-core')
    const { PrismaClient } = await import('@prisma/client')
    const db = new PrismaClient()
    await db.vipExercise.upsert({ where: { slug: 'plank' }, update: { name: 'ZZ Coach Edited Plank' }, create: { slug: 'plank', name: 'ZZ Coach Edited Plank', measure: 'TIME' } })
    const dry = await seedFitnessExercises(db, { dryRun: true })
    expect(await db.vipExercise.count({ where: { slug: 'back-squat' } })).toBe(0)
    expect(dry.skipped).toContain('plank')
    const first = await seedFitnessExercises(db)
    const second = await seedFitnessExercises(db)
    expect(first.created.length).toBeGreaterThan(15)
    expect(second.created).toEqual([])
    expect((await db.vipExercise.findUniqueOrThrow({ where: { slug: 'plank' } })).name).toBe('ZZ Coach Edited Plank')
    expect(await db.vipProgram.count({ where: { slug: { startsWith: 'zz-sample' } } })).toBe(0)
    await db.$disconnect()
  })

  it('no product / dosing / medical wording in starter exercises, fitness admin or member sources', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs')
    const root = path.resolve(__dirname, '../..')
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = path.join(dir, f)
        return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : []
      })
    const FORBIDDEN = /\b(peptides?|dos(e|es|ing|age)|inject(ion|able)?s?|reconstitut\w*|vials?|syringes?|protocols?|cures?|treats? (disease|illness)|diagnos\w*)\b/i
    const files = [
      path.join(root, 'scripts/vip/fitness-starter.ts'),
      ...walk(path.join(root, 'src/app/admin/vip/fitness')),
      ...walk(path.join(root, 'src/app/vip/(club)/fitness')),
      ...walk(path.join(root, 'src/components/vip/fitness')),
      ...walk(path.join(root, 'src/lib/vip/fitness')),
    ]
    const hits = files.flatMap((f) => {
      const m = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').match(FORBIDDEN)
      return m ? [`${path.relative(root, f)}: ${m[0]}`] : []
    })
    expect(hits).toEqual([])
  })
})
