import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { makeUser, params, req, setSession } from '../helpers'
import * as adminClassroom from '@/app/api/admin/vip/classroom/route'
import * as progress from '@/app/api/vip/lessons/[id]/progress/route'
import * as attempts from '@/app/api/vip/quizzes/[id]/attempts/route'
import * as note from '@/app/api/vip/lessons/[id]/note/route'
import * as redeem from '@/app/api/vip/trainings/[id]/redeem/route'
import * as invoice from '@/app/api/vip/trainings/[id]/invoice/route'
import { POST as markPaidPOST } from '@/app/api/admin/orders/[id]/mark-paid/route'
import { PATCH as orderPATCH } from '@/app/api/admin/orders/[id]/route'
import { getCourse, getLesson, getQuizForMember, listCourses } from '@/lib/vip/classroom'
import { CERT_CODE_RE, scoreQuiz, verifyCertificate } from '@/lib/vip/academy'
import { awardPoints, pointsBalance } from '@/lib/vip/points'
import { loadVipViewer } from '@/lib/vip/access'
import { parseTrainingNote, trainingNote } from '@/lib/vip/training-invoice'

type H = (r: NextRequest, c: { params: Promise<Record<string, unknown>> }) => Promise<Response>
const call = (fn: unknown, r: NextRequest, p: Record<string, unknown> = {}) => (fn as H)(r, params(p))

let admin: Awaited<ReturnType<typeof makeUser>>
const post = async (body: Record<string, unknown>) => {
  setSession(admin)
  const res = await call(adminClassroom.POST, req('/api/admin/vip/classroom', { body }))
  const json = await res.json()
  if (!res.ok) throw new Error(`${body.op}: ${json.error}`)
  return json.id as string
}

/** A small course built through the admin API: 2 lessons + a 2-question module quiz. */
async function buildCourse(opts: { minTier?: string; purchaseOnly?: boolean; priceCents?: number; pointsPrice?: number; tag: string }) {
  const slug = `zz-academy-${opts.tag}-${Date.now()}`
  const course = await post({
    op: 'course.upsert',
    title: `ZZ ${opts.tag}`,
    slug,
    minTier: opts.minTier ?? 'CLUB',
    published: true,
    purchaseOnly: opts.purchaseOnly,
    priceCents: opts.priceCents,
    pointsPrice: opts.pointsPrice,
  })
  const mod = await post({ op: 'module.upsert', courseId: course, title: 'ZZ module' })
  const l1 = await post({ op: 'lesson.upsert', moduleId: mod, title: 'ZZ one', body: 'placeholder', minTier: null, published: true })
  const l2 = await post({ op: 'lesson.upsert', moduleId: mod, title: 'ZZ two', body: 'placeholder', minTier: null, published: true })
  const quiz = await post({ op: 'quiz.upsert', moduleId: mod, title: 'ZZ check', passPct: 50, published: true })
  const q1 = await post({ op: 'question.upsert', quizId: quiz, prompt: 'ZZ q1', options: ['a', 'b', 'c'], correctIndex: 1, explanation: 'b is right' })
  const q2 = await post({ op: 'question.upsert', quizId: quiz, prompt: 'ZZ q2', options: ['x', 'y'], correctIndex: 0, sortOrder: 1 })
  return { course, slug, mod, l1, l2, quiz, q1, q2 }
}

const ledger = async (userId: string) => {
  const acct = await prisma.loyaltyAccount.findUnique({ where: { userId } })
  return acct ? prisma.loyaltyTransaction.findMany({ where: { accountId: acct.id }, orderBy: { createdAt: 'asc' } }) : []
}

beforeAll(async () => {
  admin = await makeUser({ tag: 'acad-admin', role: 'ADMIN' })
})

beforeEach(async () => {
  vi.mocked(sendEmail).mockClear()
  await prisma.siteSetting.deleteMany({ where: { key: { startsWith: 'vip.points.' } } })
})

describe('quiz scoring (pure)', () => {
  const qs = [
    { id: 'a', correctIndex: 1, options: ['x', 'y', 'z'] },
    { id: 'b', correctIndex: 0, options: ['x', 'y'] },
    { id: 'c', correctIndex: 2, options: ['x', 'y', 'z'] },
    { id: 'd', correctIndex: 0, options: ['x', 'y'] },
  ]
  it('scores, rounds and applies the pass mark (inclusive)', () => {
    expect(scoreQuiz(qs, { a: 1, b: 0, c: 2, d: 0 }, 70)).toMatchObject({ correct: 4, total: 4, scorePct: 100, passed: true })
    expect(scoreQuiz(qs, { a: 1, b: 0, c: 0, d: 1 }, 50)).toMatchObject({ correct: 2, scorePct: 50, passed: true })
    expect(scoreQuiz(qs, { a: 1, b: 0, c: 0, d: 1 }, 51)).toMatchObject({ passed: false })
  })
  it('unanswered, out-of-range and non-integer answers are wrong', () => {
    const r = scoreQuiz(qs, { a: 7, b: -1, c: 2.5 as number } as Record<string, number>, 10)
    expect(r.correct).toBe(0)
    expect(r.results.map((x) => x.chosen)).toEqual([null, null, null, null])
    expect(r.passed).toBe(false)
  })
  it('an empty quiz never passes', () => {
    expect(scoreQuiz([], {}, 0).passed).toBe(false)
  })
})

describe('gating: tier, purchase-only, grants', () => {
  it('a purchase-only course is closed to every tier until granted; a grant opens it regardless of tier', async () => {
    const c = await buildCourse({ tag: 'po', minTier: 'CLUB', purchaseOnly: true, pointsPrice: 300 })
    const premium = await makeUser({ tag: 'acad-po-prem', tier: 'PREMIUM' })
    const v = (await loadVipViewer(premium.id))!
    expect((await getCourse(c.slug, premium.id, v.accessTier))!.allowed).toBe(false)
    expect((await getLesson(c.l1, premium.id, v.accessTier))!.allowed).toBe(false)
    expect((await getQuizForMember(c.quiz, premium.id, v.accessTier))!.questions).toEqual([]) // withheld
    setSession(premium)
    expect((await call(progress.POST, req(`/api/vip/lessons/${c.l1}/progress`, { method: 'POST' }), { id: c.l1 })).status).toBe(403)

    await prisma.vipCourseGrant.create({ data: { userId: premium.id, courseId: c.course, source: 'admin' } })
    expect((await getCourse(c.slug, premium.id, v.accessTier))!.allowed).toBe(true)
    expect((await call(progress.POST, req(`/api/vip/lessons/${c.l1}/progress`, { method: 'POST' }), { id: c.l1 })).status).toBe(200)
  })

  it('a grant opens a higher-tier course (and its higher-tier lessons) for a Club member', async () => {
    const c = await buildCourse({ tag: 'up', minTier: 'PREMIUM' })
    const extra = await post({ op: 'lesson.upsert', moduleId: c.mod, title: 'ZZ premium-only', body: 'x', minTier: 'PREMIUM', published: true })
    const club = await makeUser({ tag: 'acad-up-club', tier: 'CLUB' })
    const v = (await loadVipViewer(club.id))!
    expect((await getLesson(extra, club.id, v.accessTier))!.allowed).toBe(false)
    expect((await listCourses(club.id, v.accessTier)).find((x) => x.id === c.course)!.allowed).toBe(false)
    await prisma.vipCourseGrant.create({ data: { userId: club.id, courseId: c.course, source: 'reward' } })
    expect((await getLesson(extra, club.id, v.accessTier))!.allowed).toBe(true)
    const listed = (await listCourses(club.id, v.accessTier)).find((x) => x.id === c.course)!
    expect(listed.allowed).toBe(true)
    expect(listed.granted).toBe(true)
  })

  it("one member's grant does not open the course for anyone else", async () => {
    const c = await buildCourse({ tag: 'iso', purchaseOnly: true, pointsPrice: 10 })
    const a = await makeUser({ tag: 'acad-iso-a', tier: 'PLUS' })
    const b = await makeUser({ tag: 'acad-iso-b', tier: 'PLUS' })
    await prisma.vipCourseGrant.create({ data: { userId: a.id, courseId: c.course, source: 'points' } })
    expect((await getCourse(c.slug, b.id, 'PLUS'))!.allowed).toBe(false)
  })
})

describe('completion, points and certificates', () => {
  it('lesson 50 / quiz 25 / course 500 — each once, even when repeated or un-marked and re-marked', async () => {
    const c = await buildCourse({ tag: 'pts' })
    const m = await makeUser({ tag: 'acad-pts', tier: 'CLUB' })
    setSession(m)
    const done = (id: string) => call(progress.POST, req(`/api/vip/lessons/${id}/progress`, { method: 'POST' }), { id })
    const r1 = await (await done(c.l1)).json()
    expect(r1.pointsAwarded).toBe(50)
    expect((await (await done(c.l1)).json()).pointsAwarded).toBe(0)
    await call(progress.DELETE, req(`/api/vip/lessons/${c.l1}/progress`, { method: 'DELETE' }), { id: c.l1 })
    expect((await (await done(c.l1)).json()).pointsAwarded).toBe(0)
    const r2 = await (await done(c.l2)).json()
    expect(r2).toMatchObject({ pointsAwarded: 50, courseCompleted: false }) // the quiz is still open

    // failed quiz: no points, retry allowed
    const fail = await (await call(attempts.POST, req(`/api/vip/quizzes/${c.quiz}/attempts`, { body: { answers: { [c.q1]: 0, [c.q2]: 1 } } }), { id: c.quiz })).json()
    expect(fail).toMatchObject({ passed: false, scorePct: 0, pointsAwarded: 0 })
    expect(fail.results[0]).toMatchObject({ correctIndex: 1, explanation: 'b is right' })
    const pass = await (await call(attempts.POST, req(`/api/vip/quizzes/${c.quiz}/attempts`, { body: { answers: { [c.q1]: 1, [c.q2]: 1 } } }), { id: c.quiz })).json()
    expect(pass).toMatchObject({ passed: true, scorePct: 50, courseCompleted: true, pointsAwarded: 25 + 500 })
    expect(pass.certificateCode).toMatch(CERT_CODE_RE)
    const again = await (await call(attempts.POST, req(`/api/vip/quizzes/${c.quiz}/attempts`, { body: { answers: { [c.q1]: 1, [c.q2]: 0 } } }), { id: c.quiz })).json()
    expect(again).toMatchObject({ passed: true, pointsAwarded: 0, certificateCode: pass.certificateCode })

    expect(await pointsBalance(m.id)).toBe(50 + 50 + 25 + 500)
    const keys = (await ledger(m.id)).map((t) => t.idempotencyKey).sort()
    expect(keys).toEqual([`course:${c.course}:${m.id}`, `lesson:${c.l1}:${m.id}`, `lesson:${c.l2}:${m.id}`, `quiz:${c.quiz}:${m.id}`].sort())
    expect(await prisma.vipCertificate.count({ where: { userId: m.id, courseId: c.course } })).toBe(1)
  })

  it('point values come from settings; 0 turns an award off', async () => {
    await prisma.siteSetting.createMany({ data: [{ key: 'vip.points.lessonComplete', value: '0' }, { key: 'vip.points.courseComplete', value: '700' }] })
    const c = await buildCourse({ tag: 'cfg' })
    await prisma.vipQuiz.delete({ where: { id: c.quiz } }) // no quiz → lessons alone finish it
    const m = await makeUser({ tag: 'acad-cfg', tier: 'CLUB' })
    setSession(m)
    await call(progress.POST, req(`/api/vip/lessons/${c.l1}/progress`, { method: 'POST' }), { id: c.l1 })
    const r = await (await call(progress.POST, req(`/api/vip/lessons/${c.l2}/progress`, { method: 'POST' }), { id: c.l2 })).json()
    expect(r).toMatchObject({ courseCompleted: true, pointsAwarded: 700 })
    expect(await pointsBalance(m.id)).toBe(700)
  })

  it('quiz answers are never sent before submitting', async () => {
    const c = await buildCourse({ tag: 'leak' })
    const m = await makeUser({ tag: 'acad-leak', tier: 'CLUB' })
    const q = (await getQuizForMember(c.quiz, m.id, 'CLUB'))!
    expect(JSON.stringify(q)).not.toMatch(/correctIndex|explanation|b is right/)
    expect(q.questions[0].options).toEqual(['a', 'b', 'c'])
  })
})

describe('certificate verification is public but shows nothing private', () => {
  it('returns only course, date and code; a name can be confirmed, never revealed', async () => {
    const c = await buildCourse({ tag: 'cert' })
    await prisma.vipQuiz.delete({ where: { id: c.quiz } })
    const m = await makeUser({ tag: 'acad-cert', tier: 'CLUB' })
    await prisma.user.update({ where: { id: m.id }, data: { name: 'Zz Jordan Private' } })
    setSession(m)
    await call(progress.POST, req(`/api/vip/lessons/${c.l1}/progress`, { method: 'POST' }), { id: c.l1 })
    const { certificateCode } = await (await call(progress.POST, req(`/api/vip/lessons/${c.l2}/progress`, { method: 'POST' }), { id: c.l2 })).json()

    const v = (await verifyCertificate(certificateCode))!
    expect(Object.keys(v).sort()).toEqual(['code', 'courseTitle', 'issuedAt', 'nameChecked', 'nameMatches'])
    const s = JSON.stringify(v)
    expect(s).not.toContain('Jordan')
    expect(s).not.toContain(m.id)
    expect(s).not.toContain(m.email)
    expect(v.nameMatches).toBeNull()
    expect((await verifyCertificate(certificateCode, 'zz jordan  PRIVATE'))!.nameMatches).toBe(true)
    expect((await verifyCertificate(certificateCode, 'Someone Else'))!.nameMatches).toBe(false)
    expect(await verifyCertificate('VP-AAAAA-AAAAA')).toBeNull()
    expect(await verifyCertificate("'; drop table x; --")).toBeNull()
  })

  it('the public /verify page renders no member details', async () => {
    const cert = await prisma.vipCertificate.findFirstOrThrow({ where: { recipientName: 'Zz Jordan Private' } })
    const { default: VerifyPage } = await import('@/app/vip/verify/[code]/page')
    setSession(null)
    const el = await VerifyPage({ params: Promise.resolve({ code: cert.code }), searchParams: Promise.resolve({}) })
    const { renderToStaticMarkup } = await import('react-dom/server')
    const html = renderToStaticMarkup(el)
    expect(html).toContain(cert.courseTitle)
    expect(html).toContain(cert.code)
    expect(html).not.toContain('Jordan')
    expect(html).not.toContain(cert.userId)
  })
})

describe('paid trainings: points', () => {
  it('spends once (REDEEM_REWARD, idempotent) and grants, even when clicked twice at once', async () => {
    const c = await buildCourse({ tag: 'redeem', purchaseOnly: true, pointsPrice: 400 })
    const m = await makeUser({ tag: 'acad-redeem', tier: 'CLUB' })
    await awardPoints({ userId: m.id, points: 1000, type: 'EARN_ADMIN', description: 'zz grant', idempotencyKey: `zz:grant:${m.id}` })
    setSession(m)
    const results = await Promise.all([1, 2, 3].map(() => call(redeem.POST, req(`/api/vip/trainings/${c.course}/redeem`, { method: 'POST' }), { id: c.course })))
    expect(results.every((r) => r.status === 200)).toBe(true)
    expect(await pointsBalance(m.id)).toBe(600)
    const spends = (await ledger(m.id)).filter((t) => t.type === 'REDEEM_REWARD')
    expect(spends).toHaveLength(1)
    expect(spends[0]).toMatchObject({ points: -400, idempotencyKey: `training:${c.course}:${m.id}` })
    expect(await prisma.vipCourseGrant.findUnique({ where: { userId_courseId: { userId: m.id, courseId: c.course } } })).toMatchObject({ source: 'points' })
  })

  it('refuses without enough points and spends nothing; refuses courses with no points price', async () => {
    const c = await buildCourse({ tag: 'poor', purchaseOnly: true, pointsPrice: 5000 })
    const free = await buildCourse({ tag: 'nopts', priceCents: 1000 })
    const m = await makeUser({ tag: 'acad-poor', tier: 'CLUB' })
    await awardPoints({ userId: m.id, points: 100, type: 'EARN_ADMIN', description: 'zz grant', idempotencyKey: `zz:grant:${m.id}` })
    setSession(m)
    expect((await call(redeem.POST, req(`/api/vip/trainings/${c.course}/redeem`, { method: 'POST' }), { id: c.course })).status).toBe(409)
    expect((await call(redeem.POST, req(`/api/vip/trainings/${free.course}/redeem`, { method: 'POST' }), { id: free.course })).status).toBe(400)
    expect(await pointsBalance(m.id)).toBe(100)
    expect(await prisma.vipCourseGrant.count({ where: { userId: m.id } })).toBe(0)
  })
})

describe('paid trainings: Zelle invoice (TRAINING:<courseId>:<userId>)', () => {
  beforeAll(async () => {
    await prisma.siteSetting.upsert({ where: { key: 'zellePhone' }, update: { value: '555-0100' }, create: { key: 'zellePhone', value: '555-0100' } })
  })

  it('creates one open invoice (re-clicks reuse it), and mark-paid grants the course exactly once', async () => {
    const c = await buildCourse({ tag: 'zelle', purchaseOnly: true, priceCents: 4900 })
    const m = await makeUser({ tag: 'acad-zelle', tier: 'CLUB' })
    setSession(m)
    const first = await call(invoice.POST, req(`/api/vip/trainings/${c.course}/invoice`, { method: 'POST' }), { id: c.course })
    expect(first.status).toBe(201)
    const a = await first.json()
    expect(a.invoice).toMatchObject({ total: 4900, zelle: { primary: '555-0100' } })
    const b = await (await call(invoice.POST, req(`/api/vip/trainings/${c.course}/invoice`, { method: 'POST' }), { id: c.course })).json()
    expect(b.reused).toBe(true)
    expect(b.invoice.orderNumber).toBe(a.invoice.orderNumber)

    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber: a.invoice.orderNumber }, include: { items: { include: { product: true } } } })
    expect(order.notes).toBe(trainingNote(c.course, m.id))
    expect(parseTrainingNote(order.notes)).toEqual({ courseId: c.course, userId: m.id })
    expect(order.items[0].product.status).toBe('ARCHIVED') // never on the storefront
    await vi.waitFor(() => expect(vi.mocked(sendEmail).mock.calls.some((x) => x[0].to === m.email && /Zelle \$49/.test(x[0].subject))).toBe(true))

    setSession({ ...admin, role: 'ADMIN' })
    const paid = await Promise.all([1, 2].map(() => markPaidPOST(req(`/api/admin/orders/${order.id}/mark-paid`, { method: 'POST' }), params({ id: order.id }))))
    expect(paid.every((r) => r.status === 200)).toBe(true)
    expect(await prisma.vipCourseGrant.findMany({ where: { userId: m.id, courseId: c.course } })).toHaveLength(1)
    expect((await prisma.vipCourseGrant.findFirstOrThrow({ where: { userId: m.id, courseId: c.course } })).source).toBe('purchase')
    // no loyalty points / stock / commission pipeline for a training invoice
    expect((await ledger(m.id)).filter((t) => t.type === 'EARN_PURCHASE')).toHaveLength(0)
    expect((await getCourse(c.slug, m.id, 'CLUB'))!.allowed).toBe(true)

    // once granted, a new invoice is refused as already owned
    setSession(m)
    expect(await (await call(invoice.POST, req(`/api/vip/trainings/${c.course}/invoice`, { method: 'POST' }), { id: c.course })).json()).toMatchObject({ already: true })
  })

  it('the order-detail PATCH paid path grants too, and the TRAINING note cannot be edited', async () => {
    const c = await buildCourse({ tag: 'patch', purchaseOnly: true, priceCents: 1500 })
    const m = await makeUser({ tag: 'acad-patch', tier: 'PLUS' })
    setSession(m)
    const { invoice: inv } = await (await call(invoice.POST, req(`/api/vip/trainings/${c.course}/invoice`, { method: 'POST' }), { id: c.course })).json()
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber: inv.orderNumber } })
    setSession({ ...admin, role: 'ADMIN' })
    const edit = await orderPATCH(req(`/api/admin/orders/${order.id}`, { method: 'PATCH', body: { notes: 'something else' } }), params({ id: order.id }))
    expect(edit.status).toBe(400)
    const res = await orderPATCH(req(`/api/admin/orders/${order.id}`, { method: 'PATCH', body: { paymentStatus: 'PAID' } }), params({ id: order.id }))
    expect(res.status).toBe(200)
    expect(await prisma.vipCourseGrant.count({ where: { userId: m.id, courseId: c.course } })).toBe(1)
  })

  it('a course without a price is not invoiceable; a forged note for another member grants nothing', async () => {
    const c = await buildCourse({ tag: 'noprice', pointsPrice: 10 })
    const m = await makeUser({ tag: 'acad-noprice', tier: 'CLUB' })
    const other = await makeUser({ tag: 'acad-other', tier: 'CLUB' })
    setSession(m)
    expect((await call(invoice.POST, req(`/api/vip/trainings/${c.course}/invoice`, { method: 'POST' }), { id: c.course })).status).toBe(400)
    const forged = await prisma.order.create({
      data: { orderNumber: `ZZ-F-${Date.now()}`, userId: m.id, email: m.email, subtotal: 1, total: 1, paymentMethod: 'zelle', notes: trainingNote(c.course, other.id) },
    })
    setSession({ ...admin, role: 'ADMIN' })
    expect((await markPaidPOST(req(`/api/admin/orders/${forged.id}/mark-paid`, { method: 'POST' }), params({ id: forged.id }))).status).toBe(200)
    expect(await prisma.vipCourseGrant.count({ where: { courseId: c.course } })).toBe(0)
  })
})

describe('private lesson notes', () => {
  it('saves per member; nobody else reads them; empty deletes', async () => {
    const c = await buildCourse({ tag: 'notes' })
    const a = await makeUser({ tag: 'acad-note-a', tier: 'CLUB' })
    const b = await makeUser({ tag: 'acad-note-b', tier: 'CLUB' })
    setSession(a)
    expect((await call(note.PUT, req(`/api/vip/lessons/${c.l1}/note`, { method: 'PUT', body: { body: 'zz my private note' } }), { id: c.l1 })).status).toBe(200)
    expect((await getLesson(c.l1, a.id, 'CLUB'))!.note?.body).toBe('zz my private note')
    expect((await getLesson(c.l1, b.id, 'CLUB'))!.note).toBeNull()
    await call(note.PUT, req(`/api/vip/lessons/${c.l1}/note`, { method: 'PUT', body: { body: '   ' } }), { id: c.l1 })
    expect(await prisma.vipLessonNote.count({ where: { userId: a.id } })).toBe(0)
  })

  it('cannot write a note on a lesson above your tier', async () => {
    const c = await buildCourse({ tag: 'notes-tier', minTier: 'PREMIUM' })
    const m = await makeUser({ tag: 'acad-note-club', tier: 'CLUB' })
    setSession(m)
    expect((await call(note.PUT, req(`/api/vip/lessons/${c.l1}/note`, { method: 'PUT', body: { body: 'x' } }), { id: c.l1 })).status).toBe(403)
  })
})
