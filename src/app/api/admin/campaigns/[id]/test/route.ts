import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { sendEmail } from '@/lib/email'
import { marketingWrapper } from '@/lib/email-templates'
import { renderTemplate } from '@/lib/campaigns'
import { z } from 'zod'
import { zodMessage } from '@/lib/zod-message'

const schema = z.object({
  email: z.string().email(),
})

async function guard() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return null
  return session
}

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://vitalityproject.global'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await guard()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  try {
    const { email } = schema.parse(await req.json())

    const campaign = await prisma.marketingCampaign.findUnique({ where: { id } })
    if (!campaign) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (campaign.channel === 'SMS') {
      return NextResponse.json(
        { error: 'SMS test not yet supported' },
        { status: 501 },
      )
    }

    const variables: Record<string, string> = {
      name: session.user.name ?? 'Admin',
      firstName:
        (session.user.name ?? 'Admin').split(/\s+/)[0] || 'Admin',
      email,
    }

    const subject = `[TEST] ${renderTemplate(campaign.subject ?? campaign.name, variables)}`
    const body = renderTemplate(campaign.body, variables)
    const html = marketingWrapper({
      subject,
      body,
      // Test sends go to an arbitrary address, not a customer — point at the
      // preferences page (the old /unsubscribe was a 404).
      unsubscribeUrl: `${APP_URL}/account/settings`,
    })

    const result = await sendEmail({ to: email, subject, html })

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'campaign.test',
      entityType: 'MarketingCampaign',
      entityId: id,
      metadata: { to: email, ok: result.success },
    })

    return NextResponse.json({
      ok: result.success,
      providerId: result.success ? result.id : null,
      error: result.success ? null : result.error,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: zodMessage(err), issues: err.issues }, { status: 400 })
    }
    console.error('[campaigns/test] error', err)
    return NextResponse.json({ error: 'Test send failed' }, { status: 500 })
  }
}
