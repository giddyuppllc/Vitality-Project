import { prisma } from './prisma'
import { sendEmail } from './email'
import { marketingWrapper } from './email-templates'
import { findCustomersBySegment, parseSegmentFilters } from './segments'
import type { User } from '@prisma/client'
import { unsubscribeUrl as unsubscribeUrlFor } from './unsubscribe'

/** Thrown when another send already claimed (or finished) this campaign. */
export class CampaignAlreadySendingError extends Error {
  constructor(public status: string) {
    super(`Campaign already ${status.toLowerCase()}`)
  }
}

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://vitalityproject.global'

/**
 * Substitute {{variable}} placeholders in a string. Unknown variables are
 * left untouched so admins can preview before matching users are known.
 */
export function renderTemplate(
  body: string,
  variables: Record<string, string>,
): string {
  if (!body) return ''
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      return variables[key] ?? ''
    }
    return `{{${key}}}`
  })
}

function firstName(name: string | null | undefined, email: string): string {
  if (name && name.trim().length > 0) return name.trim().split(/\s+/)[0]
  return email.split('@')[0]
}

export type CampaignAudience =
  | { type: 'segment'; segmentId: string }
  | { type: 'all' }
  | { type: 'new' }

/**
 * Build the recipient list for a campaign. Applies communication-preference
 * opt-outs (marketingEmail = false is excluded).
 */
export async function loadRecipients(
  campaignId: string,
): Promise<User[]> {
  const campaign = await prisma.marketingCampaign.findUnique({
    where: { id: campaignId },
    select: { segmentId: true },
  })
  if (!campaign) return []
  return audienceRecipients(campaign.segmentId)
}

/**
 * Recipients for an audience: a saved segment, or (no segment) all customers.
 * Used by the send AND by the builder's recipient-count preview, so the
 * preview is the number that will actually be mailed.
 */
export async function audienceRecipients(segmentId: string | null): Promise<User[]> {
  const segment = segmentId
    ? await prisma.savedSegment.findUnique({ where: { id: segmentId } })
    : null
  if (segmentId && !segment) return []

  let users: User[] = []
  if (segment) {
    const filters = parseSegmentFilters(segment.filters)
    const { users: matched } = await findCustomersBySegment(filters, {
      limit: 100_000,
      offset: 0,
    })
    users = matched
  } else {
    // Fallback: all customers with an email
    users = await prisma.user.findMany({
      where: { role: 'CUSTOMER' },
      orderBy: { createdAt: 'desc' },
    })
  }

  if (users.length === 0) return []

  // Respect marketing opt-outs
  const prefs = await prisma.communicationPreference.findMany({
    where: { userId: { in: users.map((u) => u.id) } },
  })
  const optedOut = new Set(
    prefs.filter((p) => p.marketingEmail === false).map((p) => p.userId),
  )
  return users.filter((u) => !optedOut.has(u.id))
}

/**
 * Send a campaign. Idempotency-ish: flips status to SENDING → SENT, writes
 * OutboundMessage rows with providerId for each recipient.
 */
export async function sendCampaign(
  campaignId: string,
): Promise<{ sent: number; skipped: number }> {
  const campaign = await prisma.marketingCampaign.findUnique({
    where: { id: campaignId },
  })
  if (!campaign) return { sent: 0, skipped: 0 }

  if (campaign.channel === 'SMS') {
    console.log('[campaigns] SMS not yet configured, skipping send', campaignId)
    return { sent: 0, skipped: 0 }
  }

  // Atomic claim: two clicks / two tabs used to both pass the status check
  // and both mail the whole list.
  const claim = await prisma.marketingCampaign.updateMany({
    where: { id: campaignId, status: { notIn: ['SENT', 'SENDING'] } },
    data: { status: 'SENDING' },
  })
  if (claim.count === 0) {
    const now = await prisma.marketingCampaign.findUnique({ where: { id: campaignId }, select: { status: true } })
    throw new CampaignAlreadySendingError(now?.status ?? 'SENT')
  }

  const recipients = await loadRecipients(campaignId)

  // A retry after a failed send must not re-mail anyone who already got it.
  const alreadySent = new Set(
    (
      await prisma.outboundMessage.findMany({
        where: { campaignId, status: 'SENT', userId: { not: null } },
        select: { userId: true },
      })
    ).map((m) => m.userId as string),
  )

  let sent = 0
  let skipped = 0

  for (const user of recipients) {
    if (!user.email || alreadySent.has(user.id)) {
      skipped++
      continue
    }
    // Per-recipient one-click link (the old ${APP_URL}/unsubscribe was a 404).
    const unsubscribeUrl = unsubscribeUrlFor(APP_URL, user.id)

    const variables: Record<string, string> = {
      name: user.name ?? firstName(user.name, user.email),
      firstName: firstName(user.name, user.email),
      email: user.email,
    }

    const renderedBody = renderTemplate(campaign.body, variables)
    const subject = renderTemplate(campaign.subject ?? 'The Vitality Project', variables)
    const html = marketingWrapper({
      subject,
      body: renderedBody,
      unsubscribeUrl,
    })

    try {
      const result = await sendEmail({
        to: user.email,
        subject,
        html,
      })

      await prisma.outboundMessage.create({
        data: {
          userId: user.id,
          toEmail: user.email,
          channel: 'EMAIL',
          subject,
          body: renderedBody,
          status: result.success ? 'SENT' : 'FAILED',
          providerId: result.success ? result.id ?? null : null,
          errorMsg: result.success ? null : result.error,
          campaignId: campaign.id,
        },
      })

      if (result.success) {
        sent++
      } else {
        skipped++
      }
    } catch (err) {
      skipped++
      console.error('[campaigns] send error', err)
      await prisma.outboundMessage.create({
        data: {
          userId: user.id,
          toEmail: user.email,
          channel: 'EMAIL',
          subject,
          body: renderedBody,
          status: 'FAILED',
          errorMsg: err instanceof Error ? err.message : 'unknown',
          campaignId: campaign.id,
        },
      })
    }
  }

  await prisma.marketingCampaign.update({
    where: { id: campaignId },
    data: {
      status: 'SENT',
      sentAt: new Date(),
      recipientCount: recipients.length,
      deliveredCount: sent + alreadySent.size,
    },
  })

  return { sent, skipped }
}
