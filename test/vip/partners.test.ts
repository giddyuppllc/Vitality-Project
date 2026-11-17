import { beforeAll, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { awardPoints, pointsBalance } from '@/lib/vip/points'
import { getOrCreateMemberCard } from '@/lib/vip/member-card'
import { computeStatement, generateStatements, statementsCsv } from '@/lib/vip/statements'
import { periodFor } from '@/lib/vip/rewards'
import { POST as portalPOST, GET as portalGET } from '@/app/api/vip/partner-portal/route'
import { POST as codePOST } from '@/app/api/vip/rewards/partner-code/route'
import { POST as adminPartners } from '@/app/api/admin/vip/partners/route'
import { POST as adminStatements, GET as statementsGET } from '@/app/api/admin/vip/partners/statements/route'
import { GET as statementsCron } from '@/app/api/cron/vip-partner-statements/route'
import { makeUser, req, setSession } from '../helpers'

const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

type U = { id: string; email: string }
let gym: { id: string }
let cafe: { id: string }
let gymStaff: U
let cafeStaff: U
let member: U
let memberNo: string

async function partner(name: string, extra: Record<string, unknown> = {}) {
  return prisma.vipPartner.create({
    data: { name, slug: `zz-${uniq()}`, earnPointsPerDollar: 5, networkFeeBps: 500, allowRedemption: true, ...extra },
  })
}

const portal = (staff: U, body: Record<string, unknown>) => {
  setSession(staff)
  return portalPOST(req('/api/vip/partner-portal', { body }))
}

beforeAll(async () => {
  gym = await partner('ZZ Hybrid Gym')
  cafe = await partner('ZZ Cafe')
  gymStaff = await makeUser({ tag: 'pt-gymstaff' }) // staff need not be members
  cafeStaff = await makeUser({ tag: 'pt-cafestaff' })
  await prisma.vipPartnerStaff.create({ data: { partnerId: gym.id, userId: gymStaff.id } })
  await prisma.vipPartnerStaff.create({ data: { partnerId: cafe.id, userId: cafeStaff.id } })
  member = await makeUser({ tag: 'pt-member', tier: 'PLUS' })
  memberNo = (await getOrCreateMemberCard(member.id)).memberNumber
})

describe('partner portal access', () => {
  it('signed out → 401; a non-staff member → 403; staff of A cannot act for B', async () => {
    setSession(null)
    expect((await portalPOST(req('/api/vip/partner-portal', { body: { op: 'lookup', memberNumber: memberNo } }))).status).toBe(401)
    expect((await portal(member, { op: 'lookup', memberNumber: memberNo })).status).toBe(403)
    const wrong = await portal(gymStaff, { op: 'purchase', partnerId: cafe.id, memberNumber: memberNo, amountCents: 1000, receiptRef: 'X1' })
    expect(wrong.status).toBe(403)
    expect(await prisma.vipPartnerTxn.count({ where: { partnerId: cafe.id } })).toBe(0)
    // deactivated staff lose access
    const gone = await makeUser({ tag: 'pt-gone' })
    await prisma.vipPartnerStaff.create({ data: { partnerId: gym.id, userId: gone.id, active: false } })
    expect((await portal(gone, { op: 'lookup', memberNumber: memberNo })).status).toBe(403)
    setSession(gymStaff)
    expect((await portalGET(req('/api/vip/partner-portal'))).status).toBe(200)
  })

  it('lookup shows first name + initial and level — never email or balance', async () => {
    const r = await portal(gymStaff, { op: 'lookup', memberNumber: `${memberNo.slice(0, 2)}-${memberNo.slice(2, 6)}-${memberNo.slice(6)}` })
    const body = await r.json()
    expect(r.status).toBe(200)
    expect(body.member.active).toBe(true)
    expect(JSON.stringify(body)).not.toContain(member.email)
    expect(body.member).not.toHaveProperty('points')
    expect((await portal(gymStaff, { op: 'lookup', memberNumber: 'VP00000000' })).status).toBe(404)
  })
})

describe('recording purchases', () => {
  it('one award per receipt, even when submitted three times at once', async () => {
    const before = await pointsBalance(member.id)
    const body = { op: 'purchase', memberNumber: memberNo, amountCents: 4999, receiptRef: `R-${uniq()}` }
    const rs = await Promise.all([1, 2, 3].map(() => portal(gymStaff, body)))
    expect(rs.map((r) => r.status).sort()).toEqual([200, 200, 201])
    expect(await pointsBalance(member.id)).toBe(before + 249) // $49.99 × 5 pts/$
    expect(await prisma.vipPartnerTxn.count({ where: { partnerId: gym.id, receiptRef: body.receiptRef } })).toBe(1)
    const ledger = await prisma.loyaltyTransaction.findFirstOrThrow({ where: { idempotencyKey: `partner-earn:${gym.id}:${body.receiptRef}` } })
    expect(ledger.type).toBe('EARN_PARTNER')
    expect(ledger.source).toMatch(/^partner:zz-/)
    // the same receipt number at a different partner is a different receipt
    const other = await portal(cafeStaff, { ...body })
    expect(other.status).toBe(201)
  })

  it('inactive members cannot earn', async () => {
    const lapsed = await makeUser({ tag: 'pt-lapsed', tier: 'CLUB', status: 'PAST_DUE' })
    const no = (await getOrCreateMemberCard(lapsed.id)).memberNumber
    const r = await portal(gymStaff, { op: 'purchase', memberNumber: no, amountCents: 1000, receiptRef: `R-${uniq()}` })
    expect(r.status).toBe(409)
    expect(await pointsBalance(lapsed.id)).toBe(0)
  })
})

describe('spending points at a partner needs the member’s one-time code', () => {
  it('no code / wrong code → nothing spent; the right code spends once; reuse refused', async () => {
    await awardPoints({ userId: member.id, points: 5000, type: 'EARN_ADMIN', description: 'zz', idempotencyKey: `t:${uniq()}` })
    const start = await pointsBalance(member.id)
    expect((await portal(gymStaff, { op: 'redeem', memberNumber: memberNo, code: '123456' })).status).toBe(409)
    setSession(member)
    const c = await codePOST(req('/api/vip/rewards/partner-code', { body: { partnerId: gym.id, points: 1500 } }))
    expect(c.status).toBe(201)
    const { code } = await c.json()
    const wrong = code === '000000' ? '111111' : '000000'
    expect((await portal(gymStaff, { op: 'redeem', memberNumber: memberNo, code: wrong })).status).toBe(409)
    // a code made for the gym is useless at the cafe
    expect((await portal(cafeStaff, { op: 'redeem', memberNumber: memberNo, code })).status).toBe(409)
    expect(await pointsBalance(member.id)).toBe(start)
    const rs = await Promise.all([1, 2, 3].map(() => portal(gymStaff, { op: 'redeem', memberNumber: memberNo, code })))
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1)
    expect(await pointsBalance(member.id)).toBe(start - 1500)
    expect((await portal(gymStaff, { op: 'redeem', memberNumber: memberNo, code })).status).toBe(409)
    expect(await pointsBalance(member.id)).toBe(start - 1500)
  })

  it('five wrong tries burn the live code', async () => {
    setSession(member)
    const { code } = await (await codePOST(req('/x', { body: { partnerId: gym.id, points: 100 } }))).json()
    const wrong = code === '999999' ? '888888' : '999999'
    for (let i = 0; i < 5; i++) await portal(gymStaff, { op: 'redeem', memberNumber: memberNo, code: wrong })
    const before = await pointsBalance(member.id)
    expect((await portal(gymStaff, { op: 'redeem', memberNumber: memberNo, code })).status).toBe(409)
    expect(await pointsBalance(member.id)).toBe(before)
  })

  it('an expired code is refused; a partner without redemption refuses codes', async () => {
    setSession(member)
    const { code } = await (await codePOST(req('/x', { body: { partnerId: gym.id, points: 100 } }))).json()
    await prisma.vipPartnerRedeemCode.updateMany({ where: { userId: member.id, usedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } })
    expect((await portal(gymStaff, { op: 'redeem', memberNumber: memberNo, code })).status).toBe(409)
    const noRedeem = await partner('ZZ Earn Only', { allowRedemption: false })
    setSession(member)
    expect((await codePOST(req('/x', { body: { partnerId: noRedeem.id, points: 100 } }))).status).toBe(409)
  })
})

describe('voids (24 hours, exactly once, own partner only)', () => {
  it('void a purchase: points taken back once; the other partner cannot void it', async () => {
    const before = await pointsBalance(member.id)
    const r = await (await portal(gymStaff, { op: 'purchase', memberNumber: memberNo, amountCents: 2000, receiptRef: `R-${uniq()}` })).json()
    expect(await pointsBalance(member.id)).toBe(before + 100)
    expect((await portal(cafeStaff, { op: 'void', txnId: r.txn.id })).status).toBe(404)
    const vs = await Promise.all([1, 2, 3].map(() => portal(gymStaff, { op: 'void', txnId: r.txn.id, reason: 'zz wrong amount' })))
    expect(vs.every((v) => v.status === 200)).toBe(true)
    expect(await pointsBalance(member.id)).toBe(before)
    expect(await prisma.loyaltyTransaction.count({ where: { idempotencyKey: `reverse-earn:partner:${r.txn.id}` } })).toBe(1)
  })

  it('void a spend: points returned once', async () => {
    setSession(member)
    const { code } = await (await codePOST(req('/x', { body: { partnerId: gym.id, points: 300 } }))).json()
    const before = await pointsBalance(member.id)
    const r = await (await portal(gymStaff, { op: 'redeem', memberNumber: memberNo, code })).json()
    expect(await pointsBalance(member.id)).toBe(before - 300)
    await Promise.all([1, 2].map(() => portal(gymStaff, { op: 'void', txnId: r.txn.id })))
    expect(await pointsBalance(member.id)).toBe(before)
  })

  it('after 24 hours a void is refused', async () => {
    const r = await (await portal(gymStaff, { op: 'purchase', memberNumber: memberNo, amountCents: 1000, receiptRef: `R-${uniq()}` })).json()
    await prisma.vipPartnerTxn.update({ where: { id: r.txn.id }, data: { createdAt: new Date(Date.now() - 25 * 3600e3) } })
    expect((await portal(gymStaff, { op: 'void', txnId: r.txn.id })).status).toBe(409)
  })

  it('a purchase whose points were already spent cannot be voided at the counter', async () => {
    const solo = await makeUser({ tag: 'pt-solo', tier: 'CLUB' })
    const no = (await getOrCreateMemberCard(solo.id)).memberNumber
    const r = await (await portal(gymStaff, { op: 'purchase', memberNumber: no, amountCents: 4000, receiptRef: `R-${uniq()}` })).json()
    setSession(solo)
    const { code } = await (await codePOST(req('/x', { body: { partnerId: gym.id, points: 200 } }))).json()
    await portal(gymStaff, { op: 'redeem', memberNumber: no, code })
    const v = await portal(gymStaff, { op: 'void', txnId: r.txn.id })
    expect(v.status).toBe(409)
    expect((await v.json()).code).toBe('points_spent')
    expect(await pointsBalance(solo.id)).toBe(0)
  })
})

describe('monthly statements', () => {
  it('math: fee on turnover, redeemed value owed to the partner, net either direction', () => {
    const t = (kind: 'EARN' | 'REDEEM', amountCents: number, points: number, voided = false) => ({ kind, amountCents, points, voidedAt: voided ? new Date() : null })
    const owesNetwork = computeStatement([t('EARN', 100_000, 5000), t('EARN', 50_050, 2502), t('REDEEM', 2000, 2000), t('EARN', 99_999, 1, true)], 500)
    expect(owesNetwork).toMatchObject({
      turnoverCents: 150_050,
      feeCents: 7503, // 5% of $1,500.50 = $75.025 → $75.03
      pointsIssued: 7502,
      pointsIssuedCents: 7502,
      pointsRedeemed: 2000,
      pointsRedeemedCents: 2000,
      netCents: 5503,
      earnCount: 2,
      redeemCount: 1,
    })
    const owesPartner = computeStatement([t('EARN', 10_000, 500), t('REDEEM', 9000, 9000)], 750)
    expect(owesPartner.feeCents).toBe(750)
    expect(owesPartner.netCents).toBe(-8250)
    expect(computeStatement([], 500).netCents).toBe(0)
  })

  it('generate (dry run writes nothing) → issue → settle with a Zelle reference; issued figures are frozen', async () => {
    const p = await partner('ZZ Statement Co', { networkFeeBps: 1000 })
    const staff = await makeUser({ tag: 'pt-st-staff' })
    await prisma.vipPartnerStaff.create({ data: { partnerId: p.id, userId: staff.id } })
    // Last month's activity, written straight to the table (the portal only records "now").
    const now = new Date()
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 10))
    const period = periodFor(lastMonth)
    const mk = (kind: 'EARN' | 'REDEEM', amountCents: number, points: number, voided = false) =>
      prisma.vipPartnerTxn.create({
        data: { partnerId: p.id, memberUserId: member.id, staffUserId: staff.id, kind, amountCents, points, receiptRef: kind === 'EARN' ? `S-${uniq()}` : null, ledgerTxnId: `zz-${uniq()}`, createdAt: lastMonth, voidedAt: voided ? lastMonth : null },
      })
    await mk('EARN', 20_000, 1000)
    await mk('EARN', 5000, 250, true)
    await mk('REDEEM', 500, 500)

    const dry = await generateStatements({ period, dryRun: true, partnerId: p.id })
    expect(dry.decisions[0].outcome).toBe('would_create')
    expect(dry.decisions[0].math.netCents).toBe(1500) // 10% of $200 − $5
    expect(await prisma.vipPartnerStatement.count({ where: { partnerId: p.id } })).toBe(0)

    const admin = await makeUser({ tag: 'pt-admin', role: 'ADMIN' })
    setSession({ ...admin, role: 'ADMIN' })
    expect((await adminStatements(req('/x', { body: { op: 'generate', period, partnerId: p.id } }))).status).toBe(200)
    const s = await prisma.vipPartnerStatement.findUniqueOrThrow({ where: { partnerId_period: { partnerId: p.id, period } } })
    expect(s).toMatchObject({ status: 'DRAFT', turnoverCents: 20_000, feeCents: 2000, pointsRedeemedCents: 500, netCents: 1500 })

    // settle before issue is refused
    expect((await adminStatements(req('/x', { body: { op: 'settle', id: s.id, settlementRef: 'ZELLE-1' } }))).status).toBe(409)
    expect((await adminStatements(req('/x', { body: { op: 'issue', id: s.id } }))).status).toBe(200)
    // a late transaction does not change an issued statement
    await mk('EARN', 100_000, 5000)
    await generateStatements({ period, partnerId: p.id })
    expect((await prisma.vipPartnerStatement.findUniqueOrThrow({ where: { id: s.id } })).turnoverCents).toBe(20_000)
    expect((await adminStatements(req('/x', { body: { op: 'settle', id: s.id, settlementRef: '' } }))).status).toBe(400)
    const settled = await adminStatements(req('/x', { body: { op: 'settle', id: s.id, settlementRef: 'ZELLE-7781' } }))
    expect(settled.status).toBe(200)
    const after = await prisma.vipPartnerStatement.findUniqueOrThrow({ where: { id: s.id } })
    expect(after).toMatchObject({ status: 'SETTLED', settlementRef: 'ZELLE-7781' })
    const actions = (await prisma.auditLog.findMany({ where: { userId: admin.id } })).map((a) => a.action)
    expect(actions).toEqual(expect.arrayContaining(['vip.partner.statement.issue', 'vip.partner.statement.settle']))
  })

  it('the current month cannot be issued early', async () => {
    const p = await partner('ZZ Early Co')
    const period = periodFor(new Date())
    await generateStatements({ period, partnerId: p.id })
    const s = await prisma.vipPartnerStatement.findUniqueOrThrow({ where: { partnerId_period: { partnerId: p.id, period } } })
    const admin = await makeUser({ tag: 'pt-admin2', role: 'ADMIN' })
    setSession({ ...admin, role: 'ADMIN' })
    expect((await adminStatements(req('/x', { body: { op: 'issue', id: s.id } }))).status).toBe(409)
  })

  it('CSV export escapes formula injection (= + - @)', async () => {
    const evil = await partner('=HYPERLINK("http://evil.invalid","x")')
    const period = periodFor(new Date())
    await generateStatements({ period, partnerId: evil.id })
    const csv = await statementsCsv({ period })
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.invalid"",""x"")"`)
    expect(csv.split('\n').some((line) => /(^|,)=/.test(line))).toBe(false)
    const admin = await makeUser({ tag: 'pt-admin3', role: 'ADMIN' })
    setSession({ ...admin, role: 'ADMIN' })
    const res = await statementsGET(req(`/api/admin/vip/partners/statements?period=${period}`))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
  })

  it('cron: guarded, does nothing except on the 1st, dryRun writes nothing', async () => {
    process.env.CRON_SECRET = 'zz-cron'
    try {
      expect((await statementsCron(new NextRequest('http://x/api/cron/vip-partner-statements'))).status).toBe(403)
      const before = await prisma.vipPartnerStatement.count()
      const ok = await statementsCron(new NextRequest('http://x/api/cron/vip-partner-statements?dryRun=1&period=2026-01', { headers: { authorization: 'Bearer zz-cron' } }))
      expect(ok.status).toBe(200)
      expect((await ok.json()).dryRun).toBe(true)
      expect(await prisma.vipPartnerStatement.count()).toBe(before)
    } finally {
      delete process.env.CRON_SECRET
    }
  })
})

describe('admin partner management', () => {
  it('create/update partner and link staff by email; audited; slug unique', async () => {
    const admin = await makeUser({ tag: 'pt-admin4', role: 'ADMIN' })
    setSession({ ...admin, role: 'ADMIN' })
    const slug = `zz-new-${uniq()}`
    const body = { name: 'ZZ New Partner', slug, earnPointsPerDollar: 3, allowRedemption: true, networkFeeBps: 450, website: 'https://example.invalid' }
    const c = await adminPartners(req('/x', { body: { op: 'create', partner: body } }))
    expect(c.status).toBe(201)
    expect((await adminPartners(req('/x', { body: { op: 'create', partner: body } }))).status).toBe(409)
    const { partner: p } = await c.json()
    const person = await makeUser({ tag: 'pt-newstaff' })
    expect((await adminPartners(req('/x', { body: { op: 'staff.add', partnerId: p.id, email: person.email } }))).status).toBe(201)
    expect((await adminPartners(req('/x', { body: { op: 'staff.add', partnerId: p.id, email: 'zz-nobody@example.invalid' } }))).status).toBe(404)
    const bad = await adminPartners(req('/x', { body: { op: 'update', id: p.id, partner: { ...body, networkFeeBps: 99_999 } } }))
    expect(bad.status).toBe(400)
    const actions = (await prisma.auditLog.findMany({ where: { userId: admin.id } })).map((a) => a.action)
    expect(actions).toEqual(expect.arrayContaining(['vip.partner.create', 'vip.partner.staff.add']))
  })
})
