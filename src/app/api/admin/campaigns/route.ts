import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(160),
  channel: z.enum(['EMAIL', 'SMS']).default('EMAIL'),
  subject: z.string().max(300).optional().nullable(),
  body: z.string().default(''),
  segmentId: z.string().optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
})

async function guard() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return null
  return session
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!(await guard())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const statusParam = url.searchParams.get('status')

  const where: Record<string, unknown> = {}
  if (
    statusParam &&
    ['DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'PAUSED', 'CANCELLED'].includes(statusParam)
  ) {
    where.status = statusParam
  }

  const campaigns = await prisma.marketingCampaign.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      segment: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(campaigns)
}

export async function POST(req: NextRequest) {
  const session = await guard()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const data = createSchema.parse(await req.json())
    const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null
    const status = scheduledAt ? 'SCHEDULED' : 'DRAFT'

    const created = await prisma.marketingCampaign.create({
      data: {
        name: data.name,
        channel: data.channel,
        subject: data.subject ?? null,
        body: data.body ?? '',
        segmentId: data.segmentId || null,
        scheduledAt,
        status,
        createdBy: session.user.id,
      },
    })

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'campaign.create',
      entityType: 'MarketingCampaign',
      entityId: created.id,
      metadata: { name: created.name, channel: created.channel },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    console.error('[campaigns] create error', err)
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
  }
}
