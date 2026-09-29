import { Resend } from 'resend'
import { prisma } from './prisma'

const FROM =
  process.env.EMAIL_FROM ||
  'The Vitality Project <noreply@vitalityproject.global>'
const REPLY_TO = process.env.EMAIL_REPLY_TO || 'support@vitalityproject.global'

// Synthetic test recipients from local E2E scripts and audits. These addresses
// at @vitalityproject.global don't have real mailboxes, so every send bounces
// and Resend adds the address to its suppression list — which hurts the
// domain's sender reputation. Block them centrally so no future codepath
// (cron, mark-paid, register, anything) can leak real Resend sends to them.
//
// Patterns deliberately prefix-anchored (^foo\+) so legitimate customer
// emails like "test.user@gmail.com" don't get caught.
const INTERNAL_RECIPIENT_PATTERNS = [
  /^test\+/i,
  /^audit\+/i,
  /^afftest\+/i,
  /^checkall\+/i,
  /^shiptest\+/i,
  /^markpaid\+/i,
  /^fixtest\+/i,
  /^smoke\+/i,
]
function isInternalRecipient(to: string): boolean {
  return INTERNAL_RECIPIENT_PATTERNS.some((re) => re.test(to))
}

// Lazy singleton — Resend's constructor throws if the key is missing, so we
// defer instantiation until first use. This keeps the build green in
// environments (CI, local dev) where RESEND_API_KEY isn't configured.
let _resend: Resend | null = null
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

export type SendEmailArgs = {
  to: string
  subject: string
  html: string
  text?: string
  tags?: Array<{ name: string; value: string }>
  /** Optional per-message Reply-To (clubhouse mail → vital@). Default: EMAIL_REPLY_TO. */
  replyTo?: string
}

export type SendEmailResult =
  | { success: true; id: string | undefined }
  | { success: false; error: string }

export async function sendEmail({
  to,
  subject,
  html,
  text,
  tags,
  replyTo,
}: SendEmailArgs): Promise<SendEmailResult> {
  // Synthetic test recipients: never actually call Resend — every send would
  // bounce and add the address to the suppression list, damaging the domain
  // reputation for real customer sends.
  if (isInternalRecipient(to)) {
    console.log(`[EMAIL SKIPPED test-recipient] to=${to} subject="${subject}"`)
    return { success: true, id: 'skipped-test' }
  }
  const resend = getResend()
  if (!resend) {
    // Dev / unconfigured — log instead of sending so the app never errors out
    console.log('[EMAIL DEV]', { to, subject })
    return { success: true, id: 'dev' }
  }
  try {
    const result = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
      text,
      replyTo: replyTo || REPLY_TO,
      ...(tags && tags.length ? { tags } : {}),
    })

    // Resend has TWO failure modes: throws OR returns { data: null, error: ... }.
    // Catch the silent-error path (e.g. domain-not-verified) explicitly.
    if (result.error || !result.data?.id) {
      const errMsg =
        result.error?.message ?? 'Resend returned no message id'
      console.error(
        `[EMAIL FAIL] to=${to} subject="${subject}" error=${errMsg}`,
      )
      return { success: false, error: errMsg }
    }

    console.log(`[EMAIL SENT] to=${to} subject="${subject}" id=${result.data.id}`)
    return { success: true, id: result.data.id }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error(
      `[EMAIL THROW] to=${to} subject="${subject}" error=${msg}`,
    )
    return { success: false, error: msg }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Tracked email — creates an OutboundMessage row and tags the Resend send
// with the row id so the webhook can correlate delivery/open/click events.
// ──────────────────────────────────────────────────────────────────────────

export type SendTrackedEmailArgs = {
  to: string
  subject: string
  html: string
  text?: string
  userId?: string | null
  sentById?: string | null
  sentByName?: string | null
  campaignId?: string | null
}

export type SendTrackedEmailResult =
  | {
      success: true
      messageId: string
      providerId: string | null
    }
  | {
      success: false
      messageId: string | null
      error: string
    }

export async function sendTrackedEmail(
  args: SendTrackedEmailArgs,
): Promise<SendTrackedEmailResult> {
  const {
    to,
    subject,
    html,
    text,
    userId,
    sentById,
    sentByName,
    campaignId,
  } = args

  // 1. Record the message first so we always have an audit row
  let outbound
  try {
    outbound = await prisma.outboundMessage.create({
      data: {
        userId: userId ?? undefined,
        toEmail: to,
        channel: 'EMAIL',
        subject,
        body: html,
        sentById: sentById ?? undefined,
        sentByName: sentByName ?? undefined,
        status: 'QUEUED',
        campaignId: campaignId ?? undefined,
      },
    })
  } catch (err) {
    console.error('[sendTrackedEmail] failed to create OutboundMessage:', err)
    return {
      success: false,
      messageId: null,
      error: 'Failed to record message',
    }
  }

  // 2. Send via Resend (or log in dev) with the row id as a tag
  const result = await sendEmail({
    to,
    subject,
    html,
    text,
    tags: [{ name: 'outbound_message_id', value: outbound.id }],
  })

  // 3. Update the message row with delivery status + provider id
  try {
    if (result.success) {
      await prisma.outboundMessage.update({
        where: { id: outbound.id },
        data: {
          status: 'SENT',
          providerId: result.id ?? null,
        },
      })
    } else {
      await prisma.outboundMessage.update({
        where: { id: outbound.id },
        data: {
          status: 'FAILED',
          errorMsg: result.error,
        },
      })
    }
  } catch (err) {
    console.error('[sendTrackedEmail] failed to update OutboundMessage:', err)
  }

  if (result.success) {
    return {
      success: true,
      messageId: outbound.id,
      providerId: result.id ?? null,
    }
  }
  return {
    success: false,
    messageId: outbound.id,
    error: result.error,
  }
}
