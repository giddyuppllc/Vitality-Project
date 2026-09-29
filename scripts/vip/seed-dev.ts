/**
 * Seeds the LOCAL THROWAWAY database with clearly fake clubhouse data for
 * development and screenshots. Refuses to run against anything but 127.0.0.1.
 *
 *   npm run vip:dev-db          (terminal 1 — throwaway Postgres on :54329)
 *   DATABASE_URL=… npx prisma db push --skip-generate
 *   DATABASE_URL=… npm run vip:seed-dev
 *
 * Every user is zz-*@example.invalid with password "zz-dev-password".
 * Classroom content is Lorem-style placeholder text, NOT real course content
 * (real content is admin-entered). No product, price, dosing or supplier text.
 */
import bcrypt from 'bcryptjs'
import { PrismaClient, type MembershipTier } from '@prisma/client'

const url = process.env.DATABASE_URL || ''
if (!/^postgresql:\/\/[^@]+@127\.0\.0\.1:/.test(url)) {
  console.error('Refusing to seed: DATABASE_URL must point at the local throwaway DB (127.0.0.1).')
  process.exit(1)
}

const prisma = new PrismaClient()
const PASSWORD = 'zz-dev-password'

async function user(tag: string, opts: { tier?: MembershipTier; role?: 'ADMIN' | 'CUSTOMER'; username: string; display?: string; bio?: string }) {
  const email = `zz-${tag}@example.invalid`
  const passwordHash = await bcrypt.hash(PASSWORD, 10)
  const u = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, username: opts.username },
    create: { email, name: opts.display ?? `ZZ ${tag}`, username: opts.username, passwordHash, role: opts.role ?? 'CUSTOMER' },
  })
  if (opts.tier) {
    await prisma.membership.upsert({
      where: { userId: u.id },
      update: { tier: opts.tier, status: 'ACTIVE', paymentConfirmedAt: new Date('2026-06-01') },
      create: { userId: u.id, tier: opts.tier, status: 'ACTIVE', startedAt: new Date('2026-05-20'), paymentConfirmedAt: new Date('2026-06-01') },
    })
  }
  await prisma.vipProfile.upsert({
    where: { userId: u.id },
    update: {},
    create: { userId: u.id, displayName: opts.display ?? null, bio: opts.bio ?? null },
  })
  return u
}

async function main() {
  const admin = await user('admin', { role: 'ADMIN', username: 'zz_admin', display: 'ZZ Team (fake)' })
  const member = await user('member', { tier: 'PLUS', username: 'zz_member', display: 'ZZ Member (fake)', bio: 'Fake test account for local development.' })
  const club = await user('club', { tier: 'CLUB', username: 'zz_club', display: 'ZZ Club Member (fake)' })
  const premium = await user('premium', { tier: 'PREMIUM', username: 'zz_premium', display: 'ZZ Premium Member (fake)' })
  await user('nonmember', { username: 'zz_nonmember', display: 'ZZ Non-member (fake)' })

  const spaceA = await prisma.vipSpace.upsert({ where: { slug: 'zz-general-test' }, update: {}, create: { slug: 'zz-general-test', name: 'ZZ Test Space', sortOrder: 1 } })
  await prisma.vipSpace.upsert({ where: { slug: 'zz-team-updates' }, update: {}, create: { slug: 'zz-team-updates', name: 'ZZ Team Updates', adminOnly: true, sortOrder: 0 } })

  if ((await prisma.vipPost.count()) === 0) {
    const pinned = await prisma.vipPost.create({
      data: { authorId: admin.id, body: '[Placeholder announcement — fake seed data for local screenshots.]', pinned: true, isAnnouncement: true },
    })
    const p1 = await prisma.vipPost.create({
      data: { authorId: member.id, spaceId: spaceA.id, body: 'Placeholder post one from a fake member. Hi @zz_club — this is seed text for layout testing.' },
    })
    await prisma.vipPost.create({ data: { authorId: premium.id, body: 'Placeholder post two. Lorem ipsum dolor sit amet, consectetur adipiscing elit.' } })
    await prisma.vipPost.create({ data: { authorId: club.id, spaceId: spaceA.id, body: 'Placeholder post three with a link https://example.invalid/test' } })
    const c1 = await prisma.vipComment.create({ data: { postId: p1.id, authorId: club.id, body: 'Placeholder comment.' } })
    await prisma.vipComment.create({ data: { postId: p1.id, authorId: premium.id, parentId: c1.id, body: 'Placeholder reply to the comment.' } })
    await prisma.vipReaction.createMany({ data: [{ userId: club.id, postId: p1.id }, { userId: premium.id, postId: p1.id }, { userId: member.id, postId: pinned.id }] })
    await prisma.vipNotification.createMany({
      data: [
        { userId: member.id, type: 'COMMENT', actorId: club.id, postId: p1.id, commentId: c1.id },
        { userId: club.id, type: 'MENTION', actorId: member.id, postId: p1.id },
      ],
    })
    await prisma.vipReport.create({ data: { reporterId: club.id, postId: p1.id, reason: 'Placeholder report for the moderation queue screenshot.' } })
  }

  if ((await prisma.vipCourse.count()) === 0) {
    const course = await prisma.vipCourse.create({
      data: { slug: 'zz-placeholder-course', title: 'ZZ Placeholder Course', summary: 'Fake course shell for local layout testing. Real content is admin-entered.', minTier: 'CLUB', published: true },
    })
    const mod = await prisma.vipModule.create({ data: { courseId: course.id, title: 'ZZ Module One', sortOrder: 0 } })
    await prisma.vipLesson.create({
      data: { moduleId: mod.id, title: 'ZZ Lesson (open)', published: true, sortOrder: 0, body: '# Placeholder heading\n\nLorem ipsum dolor sit amet.\n\n- placeholder point one\n- placeholder point two\n\n**Bold placeholder** and *italic placeholder*.' },
    })
    await prisma.vipLesson.create({ data: { moduleId: mod.id, title: 'ZZ Lesson (Plus and up)', published: true, sortOrder: 1, minTier: 'PLUS', body: 'Lorem ipsum.' } })
    await prisma.vipLesson.create({ data: { moduleId: mod.id, title: 'ZZ Lesson (Premium only)', published: true, sortOrder: 2, minTier: 'PREMIUM', body: 'Lorem ipsum.' } })
    await prisma.vipCourse.create({ data: { slug: 'zz-premium-course', title: 'ZZ Premium Placeholder Course', minTier: 'PREMIUM', published: true } })
  }

  if ((await prisma.vipEvent.count()) === 0) {
    const day = 86400e3
    await prisma.vipEvent.create({ data: { title: 'ZZ Placeholder live session', description: 'Fake event for layout testing.', startsAt: new Date(Date.now() + 3 * day), joinUrl: 'https://example.invalid/join', minTier: 'CLUB', published: true, createdById: admin.id } })
    await prisma.vipEvent.create({ data: { title: 'ZZ Premium placeholder session', startsAt: new Date(Date.now() + 10 * day), joinUrl: 'https://example.invalid/join-premium', minTier: 'PREMIUM', published: true, createdById: admin.id } })
  }

  // Store-credit history for the rewards page (fake amounts, throwaway DB).
  const credit = await prisma.storeCredit.upsert({ where: { userId: member.id }, update: {}, create: { userId: member.id, balance: 0 } })
  if ((await prisma.storeCreditTxn.count({ where: { creditId: credit.id } })) === 0) {
    await prisma.storeCreditTxn.create({ data: { creditId: credit.id, type: 'ADMIN_GRANT', amount: 1500, description: 'ZZ fake test credit' } })
    await prisma.storeCredit.update({ where: { id: credit.id }, data: { balance: 1500 } })
  }

  console.log(`Seeded. Sign in as zz-member@example.invalid / ${PASSWORD} (also zz-club, zz-premium, zz-nonmember, zz-admin).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
