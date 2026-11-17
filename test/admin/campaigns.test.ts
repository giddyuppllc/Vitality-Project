import { beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { POST as sendPOST } from '@/app/api/admin/campaigns/[id]/send/route'
import { GET as countGET } from '@/app/api/admin/customers/count/route'
import { GET as unsubGET } from '@/app/api/unsubscribe/[token]/route'
import { unsubscribeToken } from '@/lib/unsubscribe'
import { makeUser, params, req, setSession } from '../helpers'

/**
 * Campaign sends in the throwaway DB. sendEmail is mocked in test/setup.ts —
 * nothing leaves the machine. Each test scopes its audience to a segment of
 * its own fake users so other suites' users are never counted.
 */
async function segmentOf(users: { id: string }[]) {
  const tag = await prisma.tag.create({ data: { name: `zz-test-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` } })
  await prisma.userTag.createMany({ data: users.map((u) => ({ userId: u.id, tagId: tag.id })) })
  return prisma.savedSegment.create({
    data: { name: `ZZ-TEST seg ${tag.name}`, filters: JSON.stringify({ tagIds: [tag.id] }), createdBy: 'zz-test' },
  })
}

describe('admin campaigns', () => {
  let admin: { id: string; email: string }
  beforeAll(async () => {
    admin = await makeUser({ tag: 'camp-admin', role: 'ADMIN' })
  })

  it('two simultaneous Send clicks mail each recipient once', async () => {
    setSession({ ...admin, role: 'ADMIN' })
    const tag = `campdbl${Date.now().toString(36)}`
    const seg = await segmentOf([await makeUser({ tag }), await makeUser({ tag })])
    const c = await prisma.marketingCampaign.create({
      data: { name: 'ZZ-TEST dbl', channel: 'EMAIL', subject: 'Hi', body: '<p>x</p>', segmentId: seg.id, createdBy: 'zz-test' },
    })
    const calls = (sendEmail as unknown as { mock: { calls: unknown[] } }).mock.calls.length
    const [a, b] = await Promise.all([
      sendPOST(req(`http://localhost/x`, { method: 'POST' }), params({ id: c.id })),
      sendPOST(req(`http://localhost/x`, { method: 'POST' }), params({ id: c.id })),
    ])
    expect([a.status, b.status].sort()).toEqual([200, 409])
    const mailed = await prisma.outboundMessage.count({ where: { campaignId: c.id, status: 'SENT' } })
    expect(mailed).toBe(2)
    expect((sendEmail as unknown as { mock: { calls: unknown[] } }).mock.calls.length - calls).toBe(2)
  })

  it('each email carries a working one-click unsubscribe link (the old /unsubscribe was a 404)', async () => {
    setSession({ ...admin, role: 'ADMIN' })
    const tag = `campun${Date.now().toString(36)}`
    const u = await makeUser({ tag })
    const seg = await segmentOf([u])
    const c = await prisma.marketingCampaign.create({
      data: { name: 'ZZ-TEST unsub', channel: 'EMAIL', subject: 'Hi', body: '<p>x</p>', segmentId: seg.id, createdBy: 'zz-test' },
    })
    const mock = sendEmail as unknown as { mock: { calls: Array<[{ to: string; html: string }]> } }
    const before = mock.mock.calls.length
    await sendPOST(req(`http://localhost/x`, { method: 'POST' }), params({ id: c.id }))
    const html = mock.mock.calls.slice(before).find(([m]) => m.to === u.email)![0].html
    expect(html).toContain(`/api/unsubscribe/${unsubscribeToken(u.id)}`)
    expect(html).not.toMatch(/\/unsubscribe"/)

    setSession(null)
    const res = await unsubGET(req('http://localhost/x'), params({ token: unsubscribeToken(u.id) }))
    expect(res.status).toBe(307)
    const pref = await prisma.communicationPreference.findUnique({ where: { userId: u.id } })
    expect(pref?.marketingEmail).toBe(false)

    // and the recipient count now excludes them
    setSession({ ...admin, role: 'ADMIN' })
    const count = await (await countGET(req(`http://localhost/api/admin/customers/count?segmentId=${seg.id}`))).json()
    expect(count.count).toBe(0)
  })

  it('a tampered unsubscribe token changes nothing', async () => {
    const u = await makeUser({ tag: 'campforge' })
    const forged = unsubscribeToken(u.id).slice(0, -2) + 'xx'
    await unsubGET(req('http://localhost/x'), params({ token: forged }))
    expect(await prisma.communicationPreference.findUnique({ where: { userId: u.id } })).toBeNull()
  })
})
