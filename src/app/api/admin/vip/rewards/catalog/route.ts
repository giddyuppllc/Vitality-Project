import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/vip/access'
import { logAudit } from '@/lib/audit'
import { isVipMediaUrl } from '@/lib/vip/media'
import { RewardsError } from '@/lib/vip/rewards-errors'
import { rewardsErrorResponse } from '@/lib/vip/rewards-api'

export const dynamic = 'force-dynamic'

export async function GET() {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const items = await prisma.vipRewardItem.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], include: { options: true } })
  return NextResponse.json({ items })
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

const imageUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => !v || isVipMediaUrl(v) || /^https:\/\/\S+$/.test(v), 'Image must be an uploaded image or an https:// URL')
  .optional()
  .nullable()

const itemFields = z.object({
  kind: z.enum(['STORE_CREDIT', 'PRODUCT', 'MERCH', 'TRAINING', 'EXPERIENCE']),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(4000).default(''),
  imageUrl,
  pointsCost: z.number().int().min(1).max(10_000_000),
  creditCents: z.number().int().min(1).max(1_000_000).optional().nullable(),
  productId: z.string().max(64).optional().nullable(),
  variantId: z.string().max(64).optional().nullable(),
  courseId: z.string().max(64).optional().nullable(),
  stock: z.number().int().min(0).max(1_000_000).optional().nullable(),
  perMemberLimit: z.number().int().min(1).max(1000).optional().nullable(),
  minTier: z.enum(['CLUB', 'PLUS', 'PREMIUM']).default('CLUB'),
  active: z.boolean().default(false),
  sortOrder: z.number().int().min(-1000).max(1000).default(0),
})

const schema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('create'), item: itemFields }),
  z.object({ op: z.literal('update'), id: z.string().min(1), item: itemFields }),
  z.object({ op: z.literal('delete'), id: z.string().min(1) }),
  z.object({ op: z.literal('option.add'), itemId: z.string().min(1), label: z.string().trim().min(1).max(40), stock: z.number().int().min(0).max(1_000_000).nullable().optional() }),
  z.object({ op: z.literal('option.update'), id: z.string().min(1), label: z.string().trim().min(1).max(40), stock: z.number().int().min(0).max(1_000_000).nullable().optional() }),
  z.object({ op: z.literal('option.delete'), id: z.string().min(1) }),
])

type ItemInput = z.infer<typeof itemFields>

/** Kind-specific requirements; returns the data to store (fields of other kinds cleared). */
async function normalise(item: ItemInput) {
  const data = {
    kind: item.kind,
    title: item.title,
    description: item.description,
    imageUrl: item.imageUrl || null,
    pointsCost: item.pointsCost,
    creditCents: null as number | null,
    productId: null as string | null,
    variantId: null as string | null,
    courseId: null as string | null,
    stock: item.stock ?? null,
    perMemberLimit: item.perMemberLimit ?? null,
    minTier: item.minTier,
    active: item.active,
    sortOrder: item.sortOrder,
  }
  if (item.kind === 'STORE_CREDIT') {
    if (!item.creditCents) throw new RewardsError('credit_required', 'Set the store credit amount.', 400)
    data.creditCents = item.creditCents
  }
  if (item.kind === 'PRODUCT') {
    if (!item.productId) throw new RewardsError('product_required', 'Choose the product.', 400)
    const product = await prisma.product.findUnique({ where: { id: item.productId }, include: { variants: { select: { id: true } } } })
    if (!product) throw new RewardsError('product_required', 'That product does not exist.', 400)
    if (item.variantId && !product.variants.some((v) => v.id === item.variantId)) {
      throw new RewardsError('bad_variant', 'That size is not one of the product’s sizes.', 400)
    }
    if (!item.variantId && product.variants.length > 0) throw new RewardsError('variant_required', 'Choose the product size.', 400)
    data.productId = product.id
    data.variantId = item.variantId || null
  }
  if (item.kind === 'TRAINING') {
    if (!item.courseId) throw new RewardsError('course_required', 'Choose the course.', 400)
    const course = await prisma.vipCourse.findUnique({ where: { id: item.courseId }, select: { id: true } })
    if (!course) throw new RewardsError('course_required', 'That course does not exist.', 400)
    data.courseId = course.id
  }
  return data
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  const d = parsed.data
  try {
    if (d.op === 'create') {
      const data = await normalise(d.item)
      let slug = slugify(d.item.title) || 'reward'
      if (await prisma.vipRewardItem.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`
      const item = await prisma.vipRewardItem.create({ data: { ...data, slug } })
      await logAudit({ userId: gate.userId, action: 'vip.reward_item.create', entityType: 'VipRewardItem', entityId: item.id, metadata: data })
      return NextResponse.json({ ok: true, item }, { status: 201 })
    }
    if (d.op === 'update') {
      const before = await prisma.vipRewardItem.findUnique({ where: { id: d.id } })
      if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const data = await normalise(d.item)
      const item = await prisma.vipRewardItem.update({ where: { id: d.id }, data })
      await logAudit({
        userId: gate.userId,
        action: 'vip.reward_item.update',
        entityType: 'VipRewardItem',
        entityId: d.id,
        metadata: { before: { pointsCost: before.pointsCost, stock: before.stock, active: before.active, creditCents: before.creditCents }, after: data },
      })
      return NextResponse.json({ ok: true, item })
    }
    if (d.op === 'delete') {
      const used = await prisma.vipRedemption.count({ where: { itemId: d.id } })
      if (used > 0) {
        return NextResponse.json({ error: 'This reward has redemptions — turn it off (inactive) instead of deleting it.' }, { status: 409 })
      }
      const { count } = await prisma.vipRewardItem.deleteMany({ where: { id: d.id } })
      if (!count) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      await logAudit({ userId: gate.userId, action: 'vip.reward_item.delete', entityType: 'VipRewardItem', entityId: d.id })
      return NextResponse.json({ ok: true })
    }
    if (d.op === 'option.add') {
      const item = await prisma.vipRewardItem.findUnique({ where: { id: d.itemId }, select: { id: true } })
      if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const exists = await prisma.vipRewardOption.findUnique({ where: { itemId_label: { itemId: d.itemId, label: d.label } } })
      if (exists) return NextResponse.json({ error: 'That size already exists.' }, { status: 409 })
      const count = await prisma.vipRewardOption.count({ where: { itemId: d.itemId } })
      const option = await prisma.vipRewardOption.create({ data: { itemId: d.itemId, label: d.label, stock: d.stock ?? null, sortOrder: count } })
      await logAudit({ userId: gate.userId, action: 'vip.reward_option.create', entityType: 'VipRewardOption', entityId: option.id, metadata: { itemId: d.itemId, label: d.label, stock: d.stock ?? null } })
      return NextResponse.json({ ok: true, option }, { status: 201 })
    }
    if (d.op === 'option.update') {
      const before = await prisma.vipRewardOption.findUnique({ where: { id: d.id } })
      if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const option = await prisma.vipRewardOption.update({ where: { id: d.id }, data: { label: d.label, stock: d.stock ?? null } })
      await logAudit({
        userId: gate.userId,
        action: 'vip.reward_option.update',
        entityType: 'VipRewardOption',
        entityId: d.id,
        metadata: { before: { label: before.label, stock: before.stock }, after: { label: d.label, stock: d.stock ?? null } },
      })
      return NextResponse.json({ ok: true, option })
    }
    const used = await prisma.vipRedemption.count({ where: { optionId: d.id, status: { in: ['REQUESTED', 'APPROVED'] } } })
    if (used > 0) return NextResponse.json({ error: 'Open redemptions use this size — set its stock to 0 instead.' }, { status: 409 })
    const { count } = await prisma.vipRewardOption.deleteMany({ where: { id: d.id } })
    if (!count) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await logAudit({ userId: gate.userId, action: 'vip.reward_option.delete', entityType: 'VipRewardOption', entityId: d.id })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return rewardsErrorResponse(e, true)
  }
}
