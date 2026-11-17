import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/vip/access'
import { logAudit } from '@/lib/audit'
import { isVipMediaUrl } from '@/lib/vip/media'

export const dynamic = 'force-dynamic'

export async function GET() {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const partners = await prisma.vipPartner.findMany({ orderBy: { name: 'asc' }, include: { staff: true } })
  return NextResponse.json({ partners })
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v || null)
const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => !v || /^https?:\/\/\S+$/.test(v), 'Website must start with https://')
  .optional()
  .nullable()
  .transform((v) => v || null)
const logoUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => !v || isVipMediaUrl(v) || /^https:\/\/\S+$/.test(v), 'Logo must be an uploaded image or an https:// URL')
  .optional()
  .nullable()
  .transform((v) => v || null)

const partnerFields = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug: lowercase letters, numbers and dashes')
    .max(60),
  logoUrl,
  description: z.string().trim().max(4000).default(''),
  website: httpsUrl,
  address: optionalText(300),
  category: optionalText(80),
  active: z.boolean().default(true),
  earnPointsPerDollar: z.number().int().min(0).max(100),
  allowRedemption: z.boolean(),
  // Basis points: 500 = 5%.
  networkFeeBps: z.number().int().min(0).max(5000),
})

const schema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('create'), partner: partnerFields }),
  z.object({ op: z.literal('update'), id: z.string().min(1), partner: partnerFields }),
  z.object({
    op: z.literal('staff.add'),
    partnerId: z.string().min(1),
    email: z.string().trim().toLowerCase().email(),
    role: z.enum(['STAFF', 'MANAGER']).default('STAFF'),
  }),
  z.object({ op: z.literal('staff.update'), id: z.string().min(1), active: z.boolean(), role: z.enum(['STAFF', 'MANAGER']) }),
  z.object({ op: z.literal('staff.remove'), id: z.string().min(1) }),
])

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  const d = parsed.data

  if (d.op === 'create' || d.op === 'update') {
    const clash = await prisma.vipPartner.findUnique({ where: { slug: d.partner.slug }, select: { id: true } })
    if (clash && (d.op === 'create' || clash.id !== d.id)) return NextResponse.json({ error: 'That slug is taken.' }, { status: 409 })
    if (d.op === 'create') {
      const partner = await prisma.vipPartner.create({ data: d.partner })
      await logAudit({ userId: gate.userId, action: 'vip.partner.create', entityType: 'VipPartner', entityId: partner.id, metadata: d.partner })
      return NextResponse.json({ ok: true, partner }, { status: 201 })
    }
    const before = await prisma.vipPartner.findUnique({ where: { id: d.id } })
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const partner = await prisma.vipPartner.update({ where: { id: d.id }, data: d.partner })
    await logAudit({
      userId: gate.userId,
      action: 'vip.partner.update',
      entityType: 'VipPartner',
      entityId: d.id,
      metadata: {
        before: { earnPointsPerDollar: before.earnPointsPerDollar, networkFeeBps: before.networkFeeBps, allowRedemption: before.allowRedemption, active: before.active, slug: before.slug },
        after: d.partner,
      },
    })
    return NextResponse.json({ ok: true, partner })
  }

  if (d.op === 'staff.add') {
    const [partner, user] = await Promise.all([
      prisma.vipPartner.findUnique({ where: { id: d.partnerId }, select: { id: true } }),
      prisma.user.findUnique({ where: { email: d.email }, select: { id: true } }),
    ])
    if (!partner) return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
    if (!user) {
      return NextResponse.json({ error: 'No account with that email. Ask them to create a vitalityproject.global account first.' }, { status: 404 })
    }
    const staff = await prisma.vipPartnerStaff.upsert({
      where: { partnerId_userId: { partnerId: d.partnerId, userId: user.id } },
      update: { active: true, role: d.role },
      create: { partnerId: d.partnerId, userId: user.id, role: d.role, addedById: gate.userId },
    })
    await logAudit({ userId: gate.userId, action: 'vip.partner.staff.add', entityType: 'VipPartnerStaff', entityId: staff.id, metadata: { partnerId: d.partnerId, staffUserId: user.id, role: d.role } })
    return NextResponse.json({ ok: true, staff }, { status: 201 })
  }

  if (d.op === 'staff.update') {
    const { count } = await prisma.vipPartnerStaff.updateMany({ where: { id: d.id }, data: { active: d.active, role: d.role } })
    if (!count) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await logAudit({ userId: gate.userId, action: 'vip.partner.staff.update', entityType: 'VipPartnerStaff', entityId: d.id, metadata: { active: d.active, role: d.role } })
    return NextResponse.json({ ok: true })
  }

  const { count } = await prisma.vipPartnerStaff.deleteMany({ where: { id: d.id } })
  if (!count) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await logAudit({ userId: gate.userId, action: 'vip.partner.staff.remove', entityType: 'VipPartnerStaff', entityId: d.id })
  return NextResponse.json({ ok: true })
}
