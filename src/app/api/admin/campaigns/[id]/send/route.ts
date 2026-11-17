import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { CampaignAlreadySendingError, sendCampaign } from '@/lib/campaigns'

async function guard() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return null
  return session
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await guard()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const campaign = await prisma.marketingCampaign.findUnique({ where: { id } })
  if (!campaign) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (campaign.status === 'SENT' || campaign.status === 'SENDING') {
    return NextResponse.json(
      { error: `Campaign already ${campaign.status.toLowerCase()}` },
      { status: 409 },
    )
  }

  if (campaign.channel === 'SMS') {
    console.log('[campaigns/send] SMS not yet configured', id)
    await prisma.marketingCampaign.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })
    return NextResponse.json(
      { error: 'SMS channel not yet configured', sent: 0, skipped: 0 },
      { status: 501 },
    )
  }

  try {
    const result = await sendCampaign(id)

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'campaign.send',
      entityType: 'MarketingCampaign',
      entityId: id,
      metadata: { sent: result.sent, skipped: result.skipped },
    })

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof CampaignAlreadySendingError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    console.error('[campaigns/send] error', err)
    // Back to DRAFT so it can be retried — sendCampaign skips everyone who
    // already received it, so a retry can't double-mail.
    await prisma.marketingCampaign.update({
      where: { id },
      data: { status: 'DRAFT' },
    })
    return NextResponse.json(
      { error: 'Send failed', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    )
  }
}
