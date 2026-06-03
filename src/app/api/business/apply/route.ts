import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/utils'
import { sendEmail } from '@/lib/email'
import { sendOwnerSms } from '@/lib/sms'
import { newBusinessApplication } from '@/lib/email-templates'
import { createAdminNotification } from '@/lib/notifications'
import { generateUniqueTrainerCode } from '@/lib/trainer'
import { checkRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { verifyTurnstile } from '@/lib/turnstile'

export async function POST(req: NextRequest) {
  // Tighter limit on B2B applications — they're meaningful records and
  // 3/hour from one IP is plenty for legitimate gym owners.
  const rl = checkRateLimit(req, 'business-apply', { limit: 3, windowMs: 60 * 60_000 })
  if (!rl.allowed) return tooManyRequests(rl.retryAfter)

  try {
    const body = await req.json()
    const { businessName, type, contactName, email, phone, website, reason, turnstileToken } = body

    // Bot check — Turnstile widget produces turnstileToken on the client.
    // No-ops in dev when TURNSTILE_SECRET_KEY isn't set.
    const captchaOk = await verifyTurnstile(
      turnstileToken,
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    )
    if (!captchaOk) {
      return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 400 })
    }

    if (!businessName || !type || !contactName || !email || !phone) {
      return NextResponse.json(
        { error: 'All required fields must be provided' },
        { status: 400 }
      )
    }

    const validTypes = ['GYM', 'CLINIC', 'DOCTOR_OFFICE', 'OTHER']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid business type' },
        { status: 400 }
      )
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user) {
      // Create user without a password — admin will trigger an activation
      // email (with a 7-day reset token) when they approve the application.
      // No plaintext-credential leak; user sets their own password via the
      // standard reset-password flow.
      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          name: contactName,
          passwordHash: null,
          role: 'CUSTOMER',
        },
      })
    }

    // Check if user already has an organization
    const existingMembership = await prisma.orgMember.findFirst({
      where: { userId: user.id, role: 'OWNER' },
    })

    if (existingMembership) {
      return NextResponse.json(
        { error: 'You already have a business application on file' },
        { status: 400 }
      )
    }

    // Generate unique slug
    let slug = slugify(businessName)
    const existingOrg = await prisma.organization.findUnique({ where: { slug } })
    if (existingOrg) {
      slug = `${slug}-${Date.now().toString(36)}`
    }

    // Create organization with SUSPENDED status (pending approval)
    const organization = await prisma.organization.create({
      data: {
        name: businessName,
        slug,
        type: type as any,
        status: 'SUSPENDED', // Pending review — admin approves to ACTIVE
      },
    })

    // Create owner membership with auto-generated personal referral code
    const ownerCode = await generateUniqueTrainerCode(contactName)
    await prisma.orgMember.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: 'OWNER',
        referralCode: ownerCode,
      },
    })

    // Create a matching SalesLead in the pipeline — all applications flow
    // through the B2B pipeline so sales can work them. If a lead with this
    // email already exists (e.g. imported from CSV or manually entered), link
    // the new org to it instead of creating a duplicate.
    try {
      const existingLead = await prisma.salesLead.findFirst({
        where: { contactEmail: user.email, organizationId: null },
        orderBy: { createdAt: 'desc' },
      })
      if (existingLead) {
        await prisma.salesLead.update({
          where: { id: existingLead.id },
          data: {
            organizationId: organization.id,
            businessName: businessName,
            contactName: contactName,
            contactPhone: phone || existingLead.contactPhone,
            notes: [existingLead.notes, reason ? `Application reason: ${reason}` : null]
              .filter(Boolean)
              .join('\n\n') || null,
            stage: existingLead.stage === 'CLOSED_LOST' ? 'NEW' : existingLead.stage,
          },
        })
      } else {
        await prisma.salesLead.create({
          data: {
            organizationId: organization.id,
            businessName,
            contactName,
            contactEmail: user.email,
            contactPhone: phone || null,
            source: 'website_application',
            stage: 'NEW',
            notes: [
              `Business type: ${type}`,
              website ? `Website: ${website}` : null,
              reason ? `Reason: ${reason}` : null,
            ]
              .filter(Boolean)
              .join('\n') || null,
          },
        })
      }
    } catch (err) {
      // Non-fatal — application still succeeds
      console.error('Failed to create sales lead for application:', err)
    }

    // Notify admin (fire-and-forget) — email + in-app
    void (async () => {
      try {
        await createAdminNotification({
          type: 'APPLICATION_NEW',
          title: `New business application: ${businessName}`,
          body: `${contactName} (${user.email}) applied — ${type.toLowerCase()}`,
          link: '/admin/organizations',
          entityType: 'Organization',
          entityId: organization.id,
        })

        // Text the business owner — before the email early-return so SMS is
        // independent of email config.
        void sendOwnerSms(
          `Vitality: new business application — ${businessName} (${type.toLowerCase()}) from ${contactName}. Review in admin.`,
        )

        const adminEmail = process.env.ADMIN_EMAIL
        if (!adminEmail) return
        const tpl = newBusinessApplication({
          adminEmail,
          businessName,
          contactEmail: user.email,
        })
        await sendEmail({
          to: adminEmail,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
        })
      } catch (err) {
        console.error('Admin application email failed:', err)
      }
    })()

    return NextResponse.json({
      success: true,
      message: 'Application submitted successfully',
    })
  } catch (error) {
    console.error('Business application error:', error)
    return NextResponse.json(
      { error: 'Failed to submit application' },
      { status: 500 }
    )
  }
}
