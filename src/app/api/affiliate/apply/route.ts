import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { affiliateApplicationReceived, newAffiliateApplicationAlert } from '@/lib/email-templates'

function generateAffiliateCode(name: string): string {
  const base = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase()
  return `${base}${suffix}`
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { paypalEmail } = await req.json()

  // Check if already an affiliate
  const existing = await prisma.affiliate.findUnique({ where: { userId: session.user.id } })
  if (existing) return NextResponse.json({ error: 'Already applied' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  let code = generateAffiliateCode(user.name ?? user.email)
  // Ensure unique
  let attempt = 0
  while (await prisma.affiliate.findUnique({ where: { code } }) && attempt < 5) {
    code = generateAffiliateCode(user.name ?? user.email)
    attempt++
  }

  await prisma.affiliate.create({
    data: {
      userId: user.id,
      code,
      paypalEmail,
      status: 'PENDING',
    },
  })

  // Surface the application in the admin lead board so it's managed/approved
  // alongside other inbound leads. Best-effort — never block the application.
  void (async () => {
    try {
      const existingLead = await prisma.salesLead.findFirst({
        where: {
          source: 'affiliate_application',
          contactEmail: user.email.toLowerCase(),
        },
        select: { id: true },
      })
      if (!existingLead) {
        await prisma.salesLead.create({
          data: {
            businessName: user.name ?? user.email,
            contactName: user.name ?? user.email,
            contactEmail: user.email.toLowerCase(),
            source: 'affiliate_application',
            stage: 'NEW',
            notes: `Affiliate application — code ${code}${paypalEmail ? ` · PayPal: ${paypalEmail}` : ''}. Approve in Admin → Affiliates.`,
          },
        })
      }
    } catch (err) {
      console.error('Affiliate application lead creation failed:', err)
    }
  })()

  // Fire-and-forget: confirmation to applicant + alert to admin
  void (async () => {
    try {
      const applicant = affiliateApplicationReceived({
        name: user.name ?? 'there',
        code,
      })
      await sendEmail({
        to: user.email,
        subject: applicant.subject,
        html: applicant.html,
        text: applicant.text,
      })

      const adminEmail = process.env.ADMIN_EMAIL
      if (adminEmail) {
        const alert = newAffiliateApplicationAlert({
          adminEmail,
          applicantName: user.name ?? user.email,
          applicantEmail: user.email,
          code,
          paypalEmail: paypalEmail || null,
        })
        await sendEmail({
          to: adminEmail,
          subject: alert.subject,
          html: alert.html,
          text: alert.text,
        })
      }
    } catch (err) {
      console.error('Affiliate apply email failed:', err)
    }
  })()

  return NextResponse.json({ success: true, code })
}
