import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { seedClubhouse, firstOccurrence } from '../../scripts/vip/seed-core'
import { COURSES, EVENTS, SPACES, TEAM_POSTS } from '../../scripts/vip/starter-content'
import { makeUser } from '../helpers'

const db = new PrismaClient()

describe('production seed (scripts/seed-vip-clubhouse.ts)', () => {
  it('is insert-only and idempotent; never touches existing rows; creates no members', async () => {
    const admin = await makeUser({ tag: 'seed-admin', role: 'ADMIN' })
    // an existing space with the same slug, edited by an admin, must survive untouched
    await db.vipSpace.upsert({ where: { slug: 'training-lab' }, update: { name: 'ZZ Edited Name' }, create: { slug: 'training-lab', name: 'ZZ Edited Name', sortOrder: 99 } })
    const usersBefore = await db.user.count()

    const dry = await seedClubhouse(db, { authorEmail: admin.email, dryRun: true, now: new Date('2026-10-01T12:00:00Z') })
    expect(dry.created.length).toBeGreaterThan(0)
    expect(await db.vipCourse.count({ where: { slug: 'performance-reset' } })).toBe(0) // dry run wrote nothing

    const first = await seedClubhouse(db, { authorEmail: admin.email, now: new Date('2026-10-01T12:00:00Z') })
    const second = await seedClubhouse(db, { authorEmail: admin.email, now: new Date('2026-10-01T12:00:00Z') })
    expect(first.created.length).toBeGreaterThan(10)
    expect(second.created).toEqual([])
    expect(await db.user.count()).toBe(usersBefore)
    expect((await db.vipSpace.findUniqueOrThrow({ where: { slug: 'training-lab' } })).name).toBe('ZZ Edited Name')

    const courses = await db.vipCourse.findMany({ where: { slug: { in: COURSES.map((c) => c.slug) } }, include: { modules: { include: { lessons: true } } } })
    expect(courses.map((c) => [c.slug, c.minTier]).sort()).toEqual([
      ['clubhouse-orientation', 'CLUB'],
      ['foundations', 'PLUS'],
      ['performance-reset', 'PREMIUM'],
    ])
    for (const c of courses) {
      expect(c.modules.length).toBeGreaterThanOrEqual(2)
      for (const m of c.modules) {
        expect(m.lessons.length).toBeGreaterThanOrEqual(2)
        expect(m.lessons.length).toBeLessThanOrEqual(4)
        for (const l of m.lessons) expect(l.body.length).toBeGreaterThan(400)
      }
    }
    const pinned = await db.vipPost.findMany({ where: { authorId: admin.id, pinned: true } })
    expect(pinned).toHaveLength(2)
    const events = await db.vipEvent.findMany({ where: { title: { in: EVENTS.map((e) => e.title) } } })
    expect(events).toHaveLength(3)
    expect(events.every((e) => e.repeatMonthly && e.joinUrl === null && e.startsAt > new Date('2026-10-01T12:00:00Z'))).toBe(true)
    expect(await db.vipTierReward.count()).toBeGreaterThanOrEqual(3)
  })

  it('skips team posts unless the author is an existing ADMIN', async () => {
    const member = await makeUser({ tag: 'seed-notadmin', tier: 'CLUB' })
    const r = await seedClubhouse(db, { authorEmail: member.email, dryRun: true })
    expect(r.warnings.join(' ')).toContain('not an ADMIN')
  })

  it('first occurrences land on the right weekday-of-month in the member time zone', () => {
    const qa = firstOccurrence(new Date('2026-10-01T12:00:00Z'), EVENTS[0].rule, 'America/New_York')
    expect(qa.toISOString()).toBe('2026-11-06T00:00:00.000Z') // Thu Nov 5, 7pm EST (Oct 1 is too soon)
  })
})

// ── Brand + content guard (Edward's standing rules) ────────────────────────
const root = path.resolve(__dirname, '../..')
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f)
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx|svg)$/.test(f) ? [p] : []
  })
}
const CLUBHOUSE_SOURCES = [
  ...files(path.join(root, 'src/app/vip')),
  ...files(path.join(root, 'src/components/vip')),
  ...files(path.join(root, 'src/lib/vip')),
  path.join(root, 'scripts/vip/starter-content.ts'),
  path.join(root, 'scripts/vip/starter-courses.ts'),
]
// Surfaces the clubhouse must never carry: product/peptide sales, dosing,
// treatment claims, supplier / manufacturer / third-party brand names, AI model names.
const FORBIDDEN = /\b(peptides?|dos(e|es|ing|age)|inject(ion|able)?s?|reconstitut\w*|vials?|syringes?|BPC|TB-?500|agerecode|chromate|juventix|hacksmith|lance|cures?|treats? (disease|illness)|diagnos\w*|claude|gpt|openai|anthropic)\b/i

describe('clubhouse copy guard', () => {
  it('no product / dosing / supplier / model wording in any clubhouse source or starter content', () => {
    const hits: string[] = []
    for (const f of CLUBHOUSE_SOURCES) {
      const text = readFileSync(f, 'utf8')
        // comments are developer notes, not rendered copy
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      const m = text.match(FORBIDDEN)
      if (m) hits.push(`${path.relative(root, f)}: ${m[0]}`)
    }
    expect(hits).toEqual([])
  })

  it('the guard itself fires (mutation check)', () => {
    expect(FORBIDDEN.test('Reconstitute the vial')).toBe(true)
    expect(FORBIDDEN.test('AgeREcode')).toBe(true)
    expect(FORBIDDEN.test('Protein first')).toBe(false)
  })

  it('no paragraph starts with "And"; no copy-needed placeholders remain', () => {
    const texts = [
      ...COURSES.flatMap((c) => [c.summary, ...c.modules.flatMap((m) => m.lessons.map((l) => l.body))]),
      ...TEAM_POSTS.map((p) => p.body),
      ...EVENTS.map((e) => e.description),
      ...SPACES.map((s) => s.description),
      readFileSync(path.join(root, 'src/lib/vip/copy.ts'), 'utf8'),
      readFileSync(path.join(root, 'src/lib/vip/emails.ts'), 'utf8'),
    ]
    for (const t of texts) {
      for (const para of t.split(/\n\s*\n/)) expect(para.trimStart().startsWith('And ')).toBe(false)
      expect(t).not.toMatch(/copy needed/i)
    }
  })

  it('no gradient text utilities in the clubhouse', () => {
    for (const f of CLUBHOUSE_SOURCES) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/bg-clip-text|text-gradient|text-transparent/)
    }
  })
})
