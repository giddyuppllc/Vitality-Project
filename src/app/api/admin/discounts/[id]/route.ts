import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const ruleSchema = z
  .object({
    minOrderCents: z.number().int().optional().nullable(),
    productIds: z.array(z.string()).default([]),
    categoryIds: z.array(z.string()).default([]),
    customerIds: z.array(z.string()).default([]),
    newCustomersOnly: z.boolean().default(false),
    membersOnly: z.boolean().default(false),
    tierRequired: z
      .enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'])
      .nullable()
      .optional(),
    stackable: z.boolean().default(false),
    autoApply: z.boolean().default(false),
    firstPurchaseOnly: z.boolean().default(false),
    usesPerCustomer: z.number().int().optional().nullable(),
  })
  .nullable()
  .optional()

const patchSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(32)
    .transform((v) => v.toUpperCase())
    .optional(),
  type: z.enum(['PERCENTAGE', 'FIXED', 'FREE_SHIPPING', 'BOGO']).optional(),
  value: z.number().int().min(0).optional(),
  minOrder: z.number().int().optional().nullable(),
  maxUses: z.number().int().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  active: z.boolean().optional(),
  rule: ruleSchema,
})

async function guard() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return null
  return session
}

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await guard()))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const code = await prisma.discountCode.findUnique({
    where: { id },
    include: { rule: true },
  })
  if (!code) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(code)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await guard()
  if (!session)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const data = patchSchema.parse(await req.json())
    const { rule, expiresAt, ...base } = data

    const updateData: Record<string, unknown> = { ...base }
    if (expiresAt !== undefined)
      updateData.expiresAt = expiresAt ? new Date(expiresAt) : null

    // Upsert rule
    if (rule !== undefined) {
      if (rule === null) {
        await prisma.couponRule.deleteMany({ where: { discountCodeId: id } })
      } else {
        await prisma.couponRule.upsert({
          where: { discountCodeId: id },
          create: {
            discountCodeId: id,
            minOrderCents: rule.minOrderCents ?? null,
            productIds: rule.productIds ?? [],
            categoryIds: rule.categoryIds ?? [],
            customerIds: rule.customerIds ?? [],
            newCustomersOnly: rule.newCustomersOnly ?? false,
            membersOnly: rule.membersOnly ?? false,
            tierRequired: rule.tierRequired ?? null,
            stackable: rule.stackable ?? false,
            autoApply: rule.autoApply ?? false,
            firstPurchaseOnly: rule.firstPurchaseOnly ?? false,
            usesPerCustomer: rule.usesPerCustomer ?? null,
          },
          update: {
            minOrderCents: rule.minOrderCents ?? null,
            productIds: rule.productIds ?? [],
            categoryIds: rule.categoryIds ?? [],
            customerIds: rule.customerIds ?? [],
            newCustomersOnly: rule.newCustomersOnly ?? false,
            membersOnly: rule.membersOnly ?? false,
            tierRequired: rule.tierRequired ?? null,
            stackable: rule.stackable ?? false,
            autoApply: rule.autoApply ?? false,
            firstPurchaseOnly: rule.firstPurchaseOnly ?? false,
            usesPerCustomer: rule.usesPerCustomer ?? null,
          },
        })
      }
    }

    const updated = await prisma.discountCode.update({
      where: { id },
      data: updateData,
      include: { rule: true },
    })

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'discount.update',
      entityType: 'DiscountCode',
      entityId: id,
      metadata: { changes: Object.keys(data) },
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.issues }, { status: 400 })
    console.error('Discount update error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await guard()
  if (!session)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    await prisma.discountCode.delete({ where: { id } })
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'discount.delete',
      entityType: 'DiscountCode',
      entityId: id,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Discount delete error:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
