/**
 * Seeds the LOCAL THROWAWAY database for development and screenshots.
 * Refuses to run against anything but 127.0.0.1.
 *
 *   npm run vip:dev-db          (terminal 1 — throwaway Postgres on :54329)
 *   DATABASE_URL=… npx prisma db push --skip-generate
 *   DATABASE_URL=… npm run vip:seed-dev
 *
 * 1. The real starter content (scripts/vip/seed-core.ts — the same insert-only
 *    seed production runs), authored by the fake admin.
 * 2. FAKE members and activity for screenshots only — every account is
 *    zz-*@example.invalid (password "zz-dev-password"). None of this exists in
 *    the production seed. No product, price, dosing or supplier text.
 */
import bcrypt from 'bcryptjs'
import { PrismaClient, type MembershipTier } from '@prisma/client'
import { seedClubhouse } from './seed-core'

const url = process.env.DATABASE_URL || ''
if (!/^postgresql:\/\/[^@]+@127\.0\.0\.1:/.test(url)) {
  console.error('Refusing to seed: DATABASE_URL must point at the local throwaway DB (127.0.0.1).')
  process.exit(1)
}

const prisma = new PrismaClient()
const PASSWORD = 'zz-dev-password'
const HOUR = 3600e3
const ago = (h: number) => new Date(Date.now() - h * HOUR)

async function user(tag: string, opts: { tier?: MembershipTier; status?: string; role?: 'ADMIN' | 'CUSTOMER'; username: string; display: string; bio?: string }) {
  const email = `zz-${tag}@example.invalid`
  const passwordHash = await bcrypt.hash(PASSWORD, 10)
  const u = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, username: opts.username },
    create: { email, name: opts.display, username: opts.username, passwordHash, role: opts.role ?? 'CUSTOMER' },
  })
  if (opts.tier) {
    await prisma.membership.upsert({
      where: { userId: u.id },
      update: {},
      create: { userId: u.id, tier: opts.tier, status: opts.status ?? 'ACTIVE', startedAt: ago(24 * 90), paymentConfirmedAt: ago(24 * 88) },
    })
  }
  if (opts.role !== 'ADMIN') {
    await prisma.vipProfile.upsert({
      where: { userId: u.id },
      update: {},
      create: { userId: u.id, displayName: opts.display, bio: opts.bio ?? null, welcomeEmailAt: new Date() },
    })
  }
  return u
}

async function main() {
  const admin = await user('admin', { role: 'ADMIN', username: 'vitality_team', display: 'Vitality Team' })
  const report = await seedClubhouse(prisma, { authorEmail: admin.email, log: (l) => console.log(`  ${l}`) })
  report.warnings.forEach((w) => console.warn(`  ! ${w}`))

  const maya = await user('member', { tier: 'PLUS', username: 'maya_lifts', display: 'Maya R. (fake)', bio: 'Training for: my first powerlifting meet in March.\nWorking on: 7.5 hours of sleep on weeknights.\nAsk me about: meal prep for a family of four.' })
  const dre = await user('premium', { tier: 'PREMIUM', username: 'dre_runs', display: 'Andre K. (fake)', bio: 'Week 6 of the 12-Week Reset. Half marathon in April.' })
  const lena = await user('club', { tier: 'CLUB', username: 'lena_moves', display: 'Lena S. (fake)', bio: 'Back to training after two years off. Walking, lifting, sleeping better.' })
  const sam = await user('sam', { tier: 'PLUS', username: 'sam_zone2', display: 'Sam T. (fake)', bio: 'Cyclist learning to love the barbell.' })
  const priya = await user('priya', { tier: 'PREMIUM', username: 'priya_fuel', display: 'Priya M. (fake)', bio: 'Dietitian-in-training. Ask me about protein on a budget.' })
  await user('nonmember', { username: 'zz_nonmember', display: 'Jordan P. (fake, no membership)' })
  await user('joiner', { username: 'zz_joiner', display: 'Casey W. (fake, joining)' })

  const space = async (slug: string) => (await prisma.vipSpace.findUniqueOrThrow({ where: { slug } })).id

  if ((await prisma.vipPost.count({ where: { authorId: { in: [maya.id, dre.id, lena.id, sam.id, priya.id] } } })) === 0) {
    const post = (authorId: string, slug: string, body: string, h: number) =>
      space(slug).then((spaceId) => prisma.vipPost.create({ data: { authorId, spaceId, body, createdAt: ago(h) } }))

    await post(lena.id, 'introductions', 'Hi all — Lena here. Two years off training after a new job and a move. Goal for the next 90 days: three strength sessions a week and 8,000 steps a day. Nervous and excited in equal parts.', 30)
    const p1 = await post(maya.id, 'wins-check-ins', `Week 7 check-in
Training: 4/4 sessions
Sleep: 7h32 average — best week this year
Fuel: prepped every lunch on Sunday
Win: deadlift 3 x 5 at 205 lb, all clean reps
Focus: caffeine cut-off at 1 pm, no exceptions

@dre_runs your wind-down post is the reason my sleep number moved. Thank you.`, 5)
    const p2 = await post(dre.id, 'sleep-recovery', 'Wind-down that finally stuck for me: phone on the kitchen charger at 9:45, ten pages of a paper book, bedroom at 66°F. Two weeks in and my morning readiness rating went from 2s to 4s. What is in yours?', 20)
    await post(sam.id, 'training-lab', 'Form check question for the coaches: my lower back rounds on the last rep of Romanian deadlifts at 135. Is that a load problem or a hamstring mobility problem? Currently 3 x 10.', 9)
    await post(priya.id, 'fuel-nutrition', 'Protein on a budget, my weekly shop: 2 dozen eggs, 2 tubs of cottage cheese, a big bag of lentils, frozen chicken thighs and canned salmon. That covers four portions a day for about the cost of two takeout lunches.', 14)
    await post(dre.id, 'longevity-reads', 'Finished "Why We Sleep" again this month. One takeaway I am keeping: a fixed wake time does more for me than an early bedtime. Anyone else read it twice?', 48)
    await post(lena.id, 'ask-the-coaches', 'For the next Q&A: how do you balance easy cardio with strength when you only have four hours a week?', 3)

    const c1 = await prisma.vipComment.create({ data: { postId: p1.id, authorId: dre.id, body: '205 for clean fives — huge. What changed in your deadlift setup?', createdAt: ago(4) } })
    await prisma.vipComment.create({ data: { postId: p1.id, authorId: maya.id, parentId: c1.id, body: 'Bracing before the pull and slowing the first inch. Kevin mentioned it at the last Q&A.', createdAt: ago(3.5) } })
    await prisma.vipComment.create({ data: { postId: p1.id, authorId: priya.id, body: 'Sunday prep plus a 7h32 average is a serious week. Proud of you.', createdAt: ago(2) } })
    await prisma.vipComment.create({ data: { postId: p2.id, authorId: sam.id, body: 'Stealing the 66°F bedroom. Mine was at 72 all summer.', createdAt: ago(18) } })
    await prisma.vipReaction.createMany({
      data: [dre.id, lena.id, priya.id, sam.id].map((userId) => ({ userId, postId: p1.id })),
      skipDuplicates: true,
    })
    await prisma.vipReaction.createMany({ data: [maya.id, lena.id].map((userId) => ({ userId, postId: p2.id })), skipDuplicates: true })
    await prisma.vipNotification.createMany({
      data: [
        { userId: maya.id, type: 'COMMENT', actorId: dre.id, postId: p1.id, commentId: c1.id, createdAt: ago(4) },
        { userId: dre.id, type: 'MENTION', actorId: maya.id, postId: p1.id, createdAt: ago(5) },
        { userId: dre.id, type: 'COMMENT', actorId: sam.id, postId: p2.id, createdAt: ago(18) },
      ],
    })
    await prisma.vipReport.create({ data: { reporterId: lena.id, postId: p2.id, reason: 'ZZ fake report for the moderation queue screenshot.' } })
  }

  // Classroom progress + RSVPs for the screenshots.
  const lessons = await prisma.vipLesson.findMany({ where: { module: { course: { slug: 'clubhouse-orientation' } } }, orderBy: [{ module: { sortOrder: 'asc' } }, { sortOrder: 'asc' }] })
  for (const l of lessons.slice(0, 5)) {
    await prisma.vipLessonProgress.upsert({ where: { userId_lessonId: { userId: maya.id, lessonId: l.id } }, update: {}, create: { userId: maya.id, lessonId: l.id } })
  }
  const events = await prisma.vipEvent.findMany()
  for (const e of events) {
    for (const u of [maya, dre, priya]) {
      if (e.minTier === 'PREMIUM' && u.id === maya.id) continue
      await prisma.vipEventRsvp.upsert({ where: { eventId_userId: { eventId: e.id, userId: u.id } }, update: {}, create: { eventId: e.id, userId: u.id } })
    }
  }

  // Rewards history for Maya: three monthly grants (fake), one spend.
  const credit = await prisma.storeCredit.upsert({ where: { userId: maya.id }, update: {}, create: { userId: maya.id, balance: 0 } })
  if ((await prisma.storeCreditTxn.count({ where: { creditId: credit.id } })) === 0) {
    const months = [
      ['2026-07', '2026-07-01T00:05:00Z'],
      ['2026-08', '2026-08-01T00:05:00Z'],
      ['2026-09', '2026-09-01T00:05:00Z'],
    ]
    for (const [period, at] of months) {
      const txn = await prisma.storeCreditTxn.create({ data: { creditId: credit.id, type: 'MEMBER_REWARD', amount: 2000, description: `VIP monthly member reward (Plus, ${period})`, createdAt: new Date(at) } })
      await prisma.vipRewardGrant.create({ data: { userId: maya.id, period, tier: 'PLUS', amountCents: 2000, storeCreditTxnId: txn.id, createdAt: new Date(at) } })
    }
    await prisma.storeCreditTxn.create({ data: { creditId: credit.id, type: 'CHECKOUT_APPLY', amount: -1500, description: 'Applied to Zelle order ZZ-FAKE', createdAt: new Date('2026-08-19T15:00:00Z') } })
    await prisma.storeCredit.update({ where: { id: credit.id }, data: { balance: 6000 - 1500 } })
  }

  // .global fixtures for the join + checkout screenshots (throwaway DB only).
  for (const [key, value] of [['zellePhone', '(555) 010-0199'], ['zelleDisplayName', 'ZZ Test Recipient (fake)']]) {
    await prisma.siteSetting.upsert({ where: { key }, update: {}, create: { key, value } })
  }
  await prisma.product.upsert({
    where: { slug: 'zz-test-fixture' },
    update: {},
    create: { name: 'ZZ Test Fixture Item', slug: 'zz-test-fixture', description: 'Fake fixture for local screenshots only.', price: 4200, status: 'ACTIVE', trackInventory: false },
  })

  console.log(`Seeded. Sign in as zz-member@example.invalid / ${PASSWORD} (also zz-club, zz-premium, zz-sam, zz-priya, zz-nonmember, zz-joiner, zz-admin).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
