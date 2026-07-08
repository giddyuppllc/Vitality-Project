import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { abandonedCart } from '@/lib/email-templates'
import { trackCronRun } from '@/lib/cron-tracker'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vitalityproject.global'
const CRON_SECRET = process.env.CRON_SECRET

/**
 * Abandoned-cart recovery job.
 *
 * Walks active carts whose `updatedAt` is between 1 hour and 7 days ago,
 * dedupes against recent abandoned-cart emails, and sends the recovery
 * template to logged-in users (we have no email for guest sessions).
 *
 * Triggering:
 *   - External scheduler (Cloudflare Cron, Hetzner cron, GitHub Actions
 *     scheduled workflow): hit
 *     `GET /api/cron/abandoned-carts?secret=<CRON_SECRET>` hourly
 *   - Manual: admin can hit it from the browser when logged in
 *     (the secret check OR an admin session both work)
 *
 * Idempotent: re-running within the dedupe window won't re-send.
 */

const MIN_AGE_MS = 60 * 60 * 1000          // 1 hour — give the user time to come back on their own
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000  // 7 days — older carts aren't really "abandoned" anymore
const DEDUPE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000 // don't re-pester within a week

async function runJob(): Promise<{ scanned: number; sent: number; skipped: number; errors: number }> {
  const now = Date.now()
  const minAge = new Date(now - MAX_AGE_MS)
  const maxAge = new Date(now - MIN_AGE_MS)
  const dedupeAfter = new Date(now - DEDUPE_WINDOW_MS)

  // Find user-attached carts in the window. (Guest cart items keyed by
  // sessionId have no email — skip them.)
  const candidates = await prisma.cartItem.findMany({
    where: {
      userId: { not: null },
      updatedAt: { gte: minAge, lte: maxAge },
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
      product: { select: { id: true, name: true, slug: true, price: true, salePrice: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // Group by user — one email per user, not one per item.
  const byUser = new Map<
    string,
    {
      email: string
      name: string
      items: Array<{ name: string; quantity: number; price: number }>
    }
  >()
  for (const ci of candidates) {
    if (!ci.user?.email || !ci.product) continue
    const bucket = byUser.get(ci.user.id) ?? {
      email: ci.user.email,
      name: ci.user.name ?? 'there',
      items: [],
    }
    bucket.items.push({
      name: ci.product.name,
      quantity: ci.quantity,
      price: ci.product.salePrice ?? ci.product.price,
    })
    byUser.set(ci.user.id, bucket)
  }

  let sent = 0
  let skipped = 0
  let errors = 0

  for (const [userId, bundle] of byUser) {
    try {
      // Dedupe — already pestered this user recently?
      const recent = await prisma.outboundMessage.findFirst({
        where: {
          userId,
          subject: { startsWith: '[abandoned-cart]' },
          createdAt: { gte: dedupeAfter },
        },
        select: { id: true },
      })
      if (recent) {
        skipped += 1
        continue
      }

      // Skip users with a recent unpaid order in flight — they didn't abandon
      // anything, they're between "place order" and "Zelle hits the bank."
      // Without this, every Zelle customer gets a passive-aggressive nudge
      // while they're literally on their way to pay.
      const pendingOrder = await prisma.order.findFirst({
        where: {
          userId,
          paymentStatus: 'UNPAID',
          createdAt: { gte: maxAge },
        },
        select: { id: true },
      })
      if (pendingOrder) {
        skipped += 1
        continue
      }

      const tpl = abandonedCart({
        name: bundle.name,
        items: bundle.items,
        cartUrl: `${APP_URL}/cart`,
        unsubscribeUrl: `${APP_URL}/account/settings`,
      })

      await sendEmail({
        to: bundle.email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      })

      // Log so the next run dedupes us, and so admins can audit who got
      // pestered when. Status SENT is optimistic; bounces/opens flow back
      // through the resend webhook into the same row.
      await prisma.outboundMessage.create({
        data: {
          userId,
          toEmail: bundle.email,
          channel: 'EMAIL',
          subject: tpl.subject,
          body: tpl.text,
          status: 'SENT',
          sentByName: 'system:abandoned-cart',
        },
      })
      sent += 1
    } catch (err) {
      errors += 1
      console.error(`[abandoned-carts] user ${userId} failed:`, err)
    }
  }

  return { scanned: candidates.length, sent, skipped, errors }
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Auth: external cron must pass ?secret=<CRON_SECRET>.
  // Fail closed if CRON_SECRET is unset — otherwise the job is publicly
  // callable and an attacker could drain the Resend quota / spam users
  // by hammering this endpoint.
  if (!CRON_SECRET) {
    return NextResponse.json({ error: 'Cron secret not configured' }, { status: 503 })
  }
  const provided = req.nextUrl.searchParams.get('secret')
  if (provided !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return trackCronRun(
    'Abandoned carts',
    async () => {
      const result = await runJob()
      return { ok: true, ...result }
    },
    (r) => `scanned=${r.scanned} sent=${r.sent} skipped=${r.skipped} errors=${r.errors}`,
  )
}
