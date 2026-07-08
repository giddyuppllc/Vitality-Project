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
  .optional()

const schema = z.object({
  code: z
    .string()
    .min(3)
    .max(32)
    .transform((v) => v.toUpperCase()),
  type: z.enum(['PERCENTAGE', 'FIXED', 'FREE_SHIPPING', 'BOGO']),
  value: z.number().int().min(0),
  minOrder: z.number().int().optional().nullable(),
  maxUses: z.number().int().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  active: z.boolean().default(true),
  rule: ruleSchema,
})

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const codes = await prisma.discountCode.findMany({
    include: { rule: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(codes)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const data = schema.parse(await req.json())
    const { rule, expiresAt, ...base } = data

    const existing = await prisma.discountCode.findUnique({
      where: { code: base.code },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'Code already exists' },
        { status: 409 },
      )
    }

    const created = await prisma.discountCode.create({
      data: {
        ...base,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        rule: rule
          ? {
              create: {
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
            }
          : undefined,
      },
      include: { rule: true },
    })

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'discount.create',
      entityType: 'DiscountCode',
      entityId: created.id,
      metadata: {
        code: created.code,
        type: created.type,
        value: created.value,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.issues }, { status: 400 })
    console.error('Discount create error:', error)
    return NextResponse.json(
      { error: 'Failed to create discount code' },
      { status: 500 },
    )
  }
}
