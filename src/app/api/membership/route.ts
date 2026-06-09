// POST /api/membership — start a Vitality membership.
//
// Until formal CC processing is wired, payment is Zelle. This endpoint:
//   1. Records the signup (idempotent on email)
//   2. Emails an invoice with the Zelle send-to + amount + memo (= signup id)
//   3. Returns 201 to the client so the form can show "check your email"
//
// When admin marks the Zelle deposit received (via /admin), the
// MembershipSignup row gets converted into an active Membership and
// the user is notified.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { membershipInvoice } from "@/lib/email-templates";
import { getZelleIdentity } from "@/lib/zelle";

// Plan-id (from /membership UI) → display label + price (cents)
const PLAN_DETAILS: Record<string, { label: string; cents: number; tier: "CLUB" | "PLUS" | "PREMIUM" }> = {
  club:      { label: "The Club",       cents: 2500,  tier: "CLUB"    },
  monthly:   { label: "The Club",       cents: 2500,  tier: "CLUB"    }, // legacy alias
  plus:      { label: "Plus",           cents: 15000, tier: "PLUS"    },
  quarterly: { label: "Plus",           cents: 15000, tier: "PLUS"    }, // legacy alias
  premium:   { label: "Premium Stacks", cents: 25000, tier: "PREMIUM" },
  annual:    { label: "Premium Stacks", cents: 25000, tier: "PREMIUM" }, // legacy alias
};

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
  plan: z.enum(["club", "plus", "premium", "monthly", "quarterly", "annual"]).default("club"),
  source: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or plan selection" }, { status: 400 });
  }
  const { email, name, plan, source } = parsed.data;
  const planDetails = PLAN_DETAILS[plan];

  try {
    // Upsert the signup record
    const signup = await prisma.membershipSignup.upsert({
      where: { email },
      update: { name, plan, source },
      create: { email, name, plan, source },
    });

    // Invoice number = first 8 chars of the signup id, uppercased + prefix.
    // Stable across retries since signup is upserted.
    const invoiceNumber = `VP-MEM-${signup.id.slice(0, 8).toUpperCase()}`;

    // Send the invoice (best-effort; never blocks the API response)
    const zelle = await getZelleIdentity();
    const html = membershipInvoice({
      name: name ?? null,
      planLabel: planDetails.label,
      amountCents: planDetails.cents,
      invoiceNumber,
      zelle,
    });

    sendEmail({
      to: email,
      subject: `Activate your ${planDetails.label} membership — Zelle ${(planDetails.cents / 100).toFixed(2)}`,
      html,
      tags: [
        { name: "type", value: "membership_invoice" },
        { name: "plan", value: plan },
      ],
    }).catch((err) => {
      console.error("[/api/membership] invoice send failed:", err);
    });

    return NextResponse.json(
      { success: true, id: signup.id, invoiceNumber, amountCents: planDetails.cents },
      { status: 201 },
    );
  } catch (error) {
    console.error("[/api/membership]", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
