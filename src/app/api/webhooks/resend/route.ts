import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

/**
 * Resend delivery webhook.
 * Event types we care about:
 *   email.sent
 *   email.delivered
 *   email.opened
 *   email.clicked
 *   email.bounced
 *
 * We identify the OutboundMessage by:
 *   1) the `outbound_message_id` tag we set when sending, OR
 *   2) the provider id (email_id) match against OutboundMessage.providerId.
 *
 * Always returns 200 OK — we do not want Resend retrying on our errors.
 */

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return true // dev — skip verification
  if (!signatureHeader) return false
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')
    // Accept either raw hex or "sha256=" prefix
    const candidates = [expected, `sha256=${expected}`]
    return candidates.some((c) => {
      try {
        return crypto.timingSafeEqual(
          Buffer.from(c),
          Buffer.from(signatureHeader),
        )
      } catch {
        return false
      }
    })
  } catch {
    return false
  }
}

type ResendEvent = {
  type?: string
  created_at?: string
  data?: {
    email_id?: string
    to?: string | string[]
    subject?: string
    tags?: Array<{ name: string; value: string }>
    bounce?: { message?: string }
  }
}

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const raw = await req.text()
  const sig =
    req.headers.get('resend-signature') ||
    req.headers.get('svix-signature') ||
    req.headers.get('x-resend-signature')

  if (!verifySignature(raw, sig)) {
    console.warn('[resend-webhook] invalid signature')
    // Still 200 — Resend won't retry and we don't leak info
    return NextResponse.json({ ok: true })
  }

  let event: ResendEvent
  try {
    event = JSON.parse(raw)
  } catch {
    return NextResponse.json({ ok: true })
  }

  const type = event.type ?? ''
  const providerId = event.data?.email_id ?? null
  const tags = event.data?.tags ?? []
  const outboundMessageId =
    tags.find((t) => t.name === 'outbound_message_id')?.value ?? null

  try {
    // Find the OutboundMessage row
    let message = null
    if (outboundMessageId) {
      message = await prisma.outboundMessage.findUnique({
        where: { id: outboundMessageId },
      })
    }
    if (!message && providerId) {
      message = await prisma.outboundMessage.findFirst({
        where: { providerId },
      })
    }
    if (!message) {
      console.log('[resend-webhook] no matching OutboundMessage', {
        type,
        providerId,
        outboundMessageId,
      })
      return NextResponse.json({ ok: true })
    }

    const now = new Date()
    const patch: Record<string, unknown> = {}

    switch (type) {
      case 'email.sent':
        if (message.status === 'QUEUED') patch.status = 'SENT'
        if (providerId && !message.providerId) patch.providerId = providerId
        break
      case 'email.delivered':
        patch.status = 'DELIVERED'
        break
      case 'email.opened':
        if (!message.openedAt) patch.openedAt = now
        if (
          message.status !== 'CLICKED' &&
          message.status !== 'BOUNCED' &&
          message.status !== 'FAILED'
        ) {
          patch.status = 'OPENED'
        }
        break
      case 'email.clicked':
        if (!message.clickedAt) patch.clickedAt = now
        if (!message.openedAt) patch.openedAt = now
        if (message.status !== 'BOUNCED' && message.status !== 'FAILED') {
          patch.status = 'CLICKED'
        }
        break
      case 'email.bounced':
        patch.bouncedAt = now
        patch.status = 'BOUNCED'
        if (event.data?.bounce?.message) {
          patch.errorMsg = event.data.bounce.message
        }
        break
      case 'email.complained':
      case 'email.failed':
        patch.status = 'FAILED'
        break
      default:
        // Unknown event, ignore
        break
    }

    if (Object.keys(patch).length > 0) {
      await prisma.outboundMessage.update({
        where: { id: message.id },
        data: patch,
      })
    }
  } catch (err) {
    console.error('[resend-webhook] handler error:', err)
  }

  return NextResponse.json({ ok: true })
}

// Allow Resend to verify endpoint via GET ping
export async function GET() {
  return NextResponse.json({ ok: true })
}
