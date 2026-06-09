// Cron — customer-facing payment reminders for Zelle orders that have
// been sitting PENDING + UNPAID for >= 3 days. Stale-zelle-orders pings
// the admin; this one pings the CUSTOMER.
//
// Schedule: daily. De-dupes via order.notes carrying a marker per send,
// so each customer gets at most ONE reminder per order. After 14 days
// without payment we give up and stop reminding.
//
// Auth: ?secret=<CRON_SECRET> or Authorization: Bearer <CRON_SECRET>.
//   GET /api/cron/payment-reminders?secret=<CRON_SECRET>

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { paymentReminder } from "@/lib/email-templates";
import { getZelleIdentity } from "@/lib/zelle";
import { trackCronRun } from "@/lib/cron-tracker";

const REMINDER_AFTER_DAYS = 3;
const STOP_REMINDING_AFTER_DAYS = 14;
const MARKER = "[customer_payment_reminder_sent]";

// Skip obvious internal/test recipients so synthetic E2E orders don't fire
// real customer-facing reminder emails through Resend. Matches the same
// pattern used by the early-outreach campaign filter.
const INTERNAL_EMAIL_PATTERNS = [
  /@giddyupp\.com$/i,
  /^test\+/i,
  /^audit\+/i,
  /^afftest\+/i,
  /^checkall\+/i,
  /^shiptest\+/i,
  /^markpaid\+/i,
  /^fixtest\+/i,
];
function isTestRecipient(email: string): boolean {
  return INTERNAL_EMAIL_PATTERNS.some((re) => re.test(email));
}

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // bypass when unset (dev)
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("secret");
  const fromHeader = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return fromQuery === secret || fromHeader === secret;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return trackCronRun(
    "Payment reminders",
    () => doRun(),
    (r) => `scanned=${r.scanned} sent=${r.sent} alreadySent=${r.alreadySent} failed=${r.failed}`,
  );
}

async function doRun() {
  const now = Date.now();
  const reminderCutoff = new Date(now - REMINDER_AFTER_DAYS * 86400e3);
  const stopCutoff     = new Date(now - STOP_REMINDING_AFTER_DAYS * 86400e3);

  const orders = await prisma.order.findMany({
    where: {
      paymentMethod: "zelle",
      paymentStatus: "UNPAID",
      status: "PENDING",
      createdAt: { lte: reminderCutoff, gte: stopCutoff },
    },
    select: {
      id: true,
      orderNumber: true,
      email: true,
      total: true,
      createdAt: true,
      notes: true,
      shippingAddress: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  let sent = 0;
  let alreadySent = 0;
  let failed = 0;
  const results: Array<{ orderNumber: string; status: "sent" | "already-sent" | "failed"; error?: string }> = [];

  const zelle = await getZelleIdentity();

  for (const order of orders) {
    if ((order.notes ?? "").includes(MARKER)) {
      alreadySent++;
      results.push({ orderNumber: order.orderNumber, status: "already-sent" });
      continue;
    }
    if (isTestRecipient(order.email)) {
      // Mark the order as already-reminded so it doesn't keep getting
      // picked up every 6 hours. Counts as skipped, not sent.
      await prisma.order.update({
        where: { id: order.id },
        data: { notes: `${order.notes ?? ""}\n${MARKER} skipped-test ${new Date().toISOString()}`.trim() },
      });
      alreadySent++;
      results.push({ orderNumber: order.orderNumber, status: "already-sent", error: "test recipient skipped" });
      continue;
    }

    try {
      const html = paymentReminder({
        name: order.shippingAddress?.name ?? null,
        orderNumber: order.orderNumber,
        amountCents: order.total,
        ageDays: Math.floor((now - order.createdAt.getTime()) / 86400e3),
        zelle,
      });

      const result = await sendEmail({
        to: order.email,
        subject: `Reminder — Zelle payment for order ${order.orderNumber}`,
        html,
        tags: [{ name: "type", value: "payment_reminder" }],
      });

      if (!result.success) {
        failed++;
        results.push({ orderNumber: order.orderNumber, status: "failed", error: result.error });
        continue;
      }

      // Mark notes idempotently so we don't double-send
      await prisma.order.update({
        where: { id: order.id },
        data: {
          notes: `${order.notes ?? ""}\n${MARKER} ${new Date().toISOString()}`.trim(),
        },
      });
      sent++;
      results.push({ orderNumber: order.orderNumber, status: "sent" });
    } catch (err) {
      failed++;
      results.push({
        orderNumber: order.orderNumber,
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return {
    scanned: orders.length,
    sent,
    alreadySent,
    failed,
    results,
  };
}
