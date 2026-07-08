import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { trackCronRun } from '@/lib/cron-tracker'

// Cron — finds Zelle orders that have been sitting PENDING+UNPAID for >7 days
// and sends a single admin nudge email. Prevents orders from quietly aging in
// the queue when a customer never sent the Zelle (or the funds never arrived).
//
// Schedule: hourly is fine — we de-dupe via a SiteSetting marker per order so
// each stale order pings the admin exactly once.
//
// Auth: Bearer <CRON_SECRET> matching env var, or query ?secret=<CRON_SECRET>.
//   GET /api/cron/stale-zelle-orders?secret=<CRON_SECRET>

const STALE_THRESHOLD_DAYS = 7
const NUDGE_MARKER_PREFIX = 'stale_zelle_nudge_'

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // bypass when CRON_SECRET unset (dev)
  const url = new URL(req.url)
  const querySecret = url.searchParams.get('secret')
  const headerSecret = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return querySecret === secret || headerSecret === secret
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return trackCronRun(
    'Stale Zelle nudge',
    () => doRun(),
    (r) => `examined=${r.examined} nudged=${r.nudged} skipped=${r.skipped} failed=${r.failed}`,
  )
}

async function doRun() {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_DAYS * 86400e3)

  const stale = await prisma.order.findMany({
    where: {
      paymentMethod: 'zelle',
      paymentStatus: 'UNPAID',
      status: 'PENDING',
      createdAt: { lte: cutoff },
    },
    select: {
      id: true,
      orderNumber: true,
      email: true,
      total: true,
      createdAt: true,
      shippingAddress: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: 50, // safety cap
  })

  let nudged = 0
  let skipped = 0
  let failed = 0
  const results: Array<{ orderNumber: string; status: 'nudged' | 'already-nudged' | 'failed'; error?: string }> = []

  for (const order of stale) {
    // Idempotent — fire one nudge per order ever.
    const markerKey = `${NUDGE_MARKER_PREFIX}${order.id}`
    const existing = await prisma.siteSetting.findUnique({ where: { key: markerKey } })
    if (existing) {
      skipped += 1
      results.push({ orderNumber: order.orderNumber, status: 'already-nudged' })
      continue
    }

    const adminEmail = process.env.ADMIN_EMAIL
    if (!adminEmail) {
      failed += 1
      results.push({ orderNumber: order.orderNumber, status: 'failed', error: 'ADMIN_EMAIL not set' })
      continue
    }

    const ageDays = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 86400e3)
    const customer = order.shippingAddress?.name || order.email

    const html = `<!doctype html>
<html><body style="margin:0;background:#0c0e1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#cbd5e1;padding:32px 16px;">
  <div style="max-width:560px;margin:0 auto;background:rgba(20,24,42,0.7);border:1px solid rgba(245,158,11,0.4);border-radius:14px;padding:28px;">
    <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#fcd34d;margin-bottom:8px;">Stale Zelle order</div>
    <h1 style="margin:0 0 12px;font-size:22px;color:#fff;">Order #${order.orderNumber} — ${ageDays} days unpaid</h1>
    <p style="margin:0 0 12px;line-height:1.6;font-size:14px;">A Zelle order has been sitting <strong style="color:#fff;">PENDING/UNPAID for ${ageDays} days</strong>. Decide whether to nudge the customer, mark it paid, or cancel it.</p>
    <div style="background:#0c0e1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px;margin:14px 0;font-size:13px;">
      <div><strong style="color:#fff;">Customer:</strong> ${customer}</div>
      <div><strong style="color:#fff;">Email:</strong> ${order.email}</div>
      <div><strong style="color:#fff;">Total:</strong> $${(order.total / 100).toFixed(2)}</div>
      <div><strong style="color:#fff;">Placed:</strong> ${new Date(order.createdAt).toLocaleString()}</div>
    </div>
    <div style="text-align:center;margin:18px 0;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://vitalityproject.global'}/admin/orders/${order.id}" style="display:inline-block;background:#6270f2;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:9px;">Open order in admin</a>
    </div>
    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">This is a one-shot reminder per order — you won't get bothered about #${order.orderNumber} again.</p>
  </div>
</body></html>`

    const text = `Stale Zelle order #${order.orderNumber}\n\n${ageDays} days unpaid.\nCustomer: ${customer}\nEmail: ${order.email}\nTotal: $${(order.total / 100).toFixed(2)}\nPlaced: ${order.createdAt}\n\nOpen: ${process.env.NEXT_PUBLIC_APP_URL || 'https://vitalityproject.global'}/admin/orders/${order.id}\n`

    try {
      const result = await sendEmail({
        to: adminEmail,
        subject: `[stale Zelle] #${order.orderNumber} — ${ageDays} days unpaid — $${(order.total / 100).toFixed(2)}`,
        html,
        text,
      })
      if (result.success) {
        await prisma.siteSetting.create({
          data: {
            key: markerKey,
            value: JSON.stringify({
              nudgedAt: new Date().toISOString(),
              orderNumber: order.orderNumber,
              ageDaysAtNudge: ageDays,
            }),
          },
        })
        nudged += 1
        results.push({ orderNumber: order.orderNumber, status: 'nudged' })
      } else {
        failed += 1
        results.push({ orderNumber: order.orderNumber, status: 'failed', error: result.error })
      }
    } catch (err) {
      failed += 1
      results.push({
        orderNumber: order.orderNumber,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return {
    ok: true as const,
    examined: stale.length,
    nudged,
    skipped,
    failed,
    thresholdDays: STALE_THRESHOLD_DAYS,
    results,
  }
}
