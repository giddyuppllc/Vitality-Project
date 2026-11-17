import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { logAudit } from '@/lib/audit'
import { authOptions } from '@/lib/auth'
import {
  getRecipients,
  getCampaignStatus,
  ensureDiscountCode,
  sendCampaign,
  CAMPAIGN_DISCOUNT_CODE,
  CAMPAIGN_DISCOUNT_PCT,
  CAMPAIGN_DISCOUNT_DAYS,
} from '@/lib/early-outreach'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return null
  return session
}

// GET — preview: who's in the recipient list, has it been sent, what discount
export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [recipients, status] = await Promise.all([
    getRecipients(),
    getCampaignStatus(),
  ])

  return NextResponse.json({
    recipients,
    recipientCount: recipients.length,
    status,
    discount: {
      code: CAMPAIGN_DISCOUNT_CODE,
      pct: CAMPAIGN_DISCOUNT_PCT,
      daysValid: CAMPAIGN_DISCOUNT_DAYS,
    },
  })
}

// POST — actually send. Idempotent — second call is a no-op.
export async function POST(_req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Make sure the discount code exists before send so the email doesn't
  // promise a code the customer can't actually use at checkout.
  await ensureDiscountCode()

  const result = await sendCampaign({
    triggeredByUserId: session.user.id,
    triggeredByEmail: session.user.email ?? 'admin',
  })

  if (result.alreadySent) {
    return NextResponse.json(
      { error: 'Campaign already sent. Check the campaign status before retrying.' },
      { status: 409 },
    )
  }

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    action: 'campaign.early_outreach.send',
    entityType: 'MarketingCampaign',
    metadata: { sent: result.sent, failed: result.failed, recipients: result.recipients.length },
  })

  return NextResponse.json({
    ok: true,
    sent: result.sent,
    failed: result.failed,
    recipients: result.recipients,
  })
}
