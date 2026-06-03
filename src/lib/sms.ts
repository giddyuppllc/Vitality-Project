/**
 * Twilio SMS sender. Mirrors the email.ts API style for consistency.
 *
 * Required env vars (set on Hetzner production .env):
 *   TWILIO_ACCOUNT_SID       — starts with "AC..."
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM              — e.g. "+15555551234" (must be a Twilio number you own)
 *
 * Without those vars set, sendSMS() runs in DEV-LOG mode — it logs the
 * payload to console and returns success without actually hitting Twilio.
 * Same fallback pattern as src/lib/email.ts so dev/CI builds never fail.
 */

interface SmsArgs {
  to: string         // E.164 format, e.g. "+15555551234"
  body: string       // SMS text — Twilio caps each segment at 160 chars (or 70 for unicode)
}

interface SmsResult {
  success: boolean
  id?: string         // Twilio Message SID
  error?: string
  dev?: boolean       // true when dev-log fallback was used
}

const TWILIO_BASE = 'https://api.twilio.com/2010-04-01'

export async function sendSMS({ to, body }: SmsArgs): Promise<SmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM

  if (!accountSid || !authToken || !from) {
    console.log('[SMS DEV]', { to, body: body.slice(0, 80), from })
    return { success: true, id: 'dev', dev: true }
  }

  // Twilio classic REST: form-urlencoded POST with Basic auth
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  const params = new URLSearchParams({
    To: to,
    From: from,
    Body: body,
  })

  try {
    const res = await fetch(`${TWILIO_BASE}/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const data = (await res.json().catch(() => null)) as {
      sid?: string
      status?: string
      message?: string
      error_message?: string
    } | null

    if (!res.ok) {
      const msg = data?.error_message ?? data?.message ?? `Twilio ${res.status}`
      console.error('Twilio SMS error:', msg)
      return { success: false, error: msg }
    }

    return { success: true, id: data?.sid }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown SMS error'
    console.error('SMS network error:', msg)
    return { success: false, error: msg }
  }
}

/**
 * Notify the business owner's cell of a site event (new order, new
 * application/lead, contact-form message). Destination is OWNER_SMS_NUMBER.
 *
 * Best-effort and SELF-DISABLING: no-ops when OWNER_SMS_NUMBER isn't set, and
 * the underlying sendSMS() dev-logs (no real send) when the Twilio creds are
 * absent — so the site runs fine before the number + creds are wired in.
 * Never throws; call it `void sendOwnerSms(...)` from request handlers so an
 * SMS hiccup can't break a checkout / application / contact submit.
 */
export async function sendOwnerSms(body: string): Promise<void> {
  const owner = process.env.OWNER_SMS_NUMBER
  if (!owner) {
    console.info('[sms] owner alert skipped — OWNER_SMS_NUMBER not set')
    return
  }
  try {
    const r = await sendSMS({ to: owner, body })
    if (!r.success) console.warn('[sms] owner alert not delivered:', r.error)
  } catch (err) {
    console.warn('[sms] owner alert failed', err)
  }
}

/**
 * Tracked SMS — creates an OutboundMessage record (channel=SMS) before sending,
 * mirrors src/lib/email.ts sendTrackedEmail. Use for admin → customer messages
 * and marketing campaigns where delivery analytics matter.
 */
export async function sendTrackedSMS(args: {
  to: string
  body: string
  userId?: string
  sentById?: string
  sentByName?: string
  campaignId?: string
}): Promise<SmsResult & { messageId?: string }> {
  // Lazy import to avoid a hard prisma dep at top level in case this lib
  // is imported in environments without DB (e.g. analytics worker).
  const { prisma } = await import('@/lib/prisma')

  const message = await prisma.outboundMessage.create({
    data: {
      userId: args.userId,
      toPhone: args.to,
      channel: 'SMS',
      body: args.body,
      sentById: args.sentById,
      sentByName: args.sentByName,
      campaignId: args.campaignId,
      status: 'QUEUED',
    },
  })

  const result = await sendSMS({ to: args.to, body: args.body })

  await prisma.outboundMessage.update({
    where: { id: message.id },
    data: {
      status: result.success ? 'SENT' : 'FAILED',
      providerId: result.id,
      errorMsg: result.error,
    },
  })

  return { ...result, messageId: message.id }
}
