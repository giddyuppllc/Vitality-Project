import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { sendEmail } from '@/lib/email'
import { gymOwnerInvite } from '@/lib/email-templates'
import { slugify } from '@/lib/utils'
import { generateUniqueTrainerCode } from '@/lib/trainer'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import type { OrgType } from '@prisma/client'

/**
 * GET /api/admin/organizations
 * Quick list for the admin index page (paginated by status filter).
 */
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? undefined

  const orgs = await prisma.organization.findMany({
    where: status ? { status: status as any } : undefined,
    include: {
      _count: { select: { locations: true, members: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(orgs)
}

const inviteSchema = z.object({
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  orgName: z.string().min(2),
  orgType: z.enum(['GYM', 'CLINIC', 'DOCTOR_OFFICE', 'OTHER']),
})

/**
 * POST /api/admin/organizations
 * Admin-invited gym onboarding. Creates an ACTIVE org + OWNER membership +
 * 7-day activation token. The owner receives a link to set their own password.
 *
 * Use case: outbound sales — you've already talked to the gym, you don't want
 * them filling out the public application form.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(', ') },
      { status: 400 }
    )
  }

  const { ownerName, ownerEmail: rawEmail, orgName, orgType } = parsed.data
  const ownerEmail = rawEmail.toLowerCase()

  // Refuse if owner is already running another org (would create role
  // confusion — admin can re-promote case-by-case manually if needed)
  const existing = await prisma.user.findUnique({
    where: { email: ownerEmail },
    include: { orgMemberships: { where: { role: { in: ['OWNER', 'ADMIN'] } } } },
  })

  if (existing && existing.orgMemberships.length > 0) {
    return NextResponse.json(
      {
        error:
          'That email is already an OWNER or ADMIN of another organization. Reach out to support if you need to move them.',
      },
      { status: 409 }
    )
  }

  // Create / update user, create org + membership, set activation token —
  // all atomic. No plaintext password is generated; brand-new users get
  // passwordHash=null and must use the activation link.
  const activationToken = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const result = await prisma.$transaction(async (tx) => {
    let user = existing
    if (user) {
      // Existing customer/affiliate — promote with the same name update +
      // (re)attach a token only if they have no password yet
      const updates: any = { name: user.name ?? ownerName }
      if (!user.passwordHash) {
        updates.resetToken = activationToken
        updates.resetTokenExpiry = expires
      }
      user = await tx.user.update({ where: { id: user.id }, data: updates, include: { orgMemberships: true } })
    } else {
      user = await tx.user.create({
        data: {
          email: ownerEmail,
          name: ownerName,
          passwordHash: null,
          role: 'CUSTOMER', // platform role; OWNER lives on OrgMember
          resetToken: activationToken,
          resetTokenExpiry: expires,
        },
        include: { orgMemberships: true },
      })
    }

    // Generate unique slug (collision-safe — append timestamp suffix on hit)
    let slug = slugify(orgName)
    const slugClash = await tx.organization.findUnique({ where: { slug } })
    if (slugClash) slug = `${slug}-${Date.now().toString(36)}`

    const org = await tx.organization.create({
      data: {
        name: orgName,
        slug,
        type: orgType as OrgType,
        status: 'ACTIVE', // admin-invited → active immediately
      },
    })

    const ownerCode = await generateUniqueTrainerCode(ownerName)
    await tx.orgMember.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        role: 'OWNER',
        referralCode: ownerCode,
      },
    })

    return { user, org }
  })

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    action: 'org.invite_owner',
    entityType: 'Organization',
    entityId: result.org.id,
    metadata: { ownerEmail, orgName, orgType },
  })

  // Send activation email — fire-and-forget, but track success for the
  // response so the admin UI can fall back to the link if delivery fails
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vitalityproject.global'
  // If the existing user already has a password, no token attached — they
  // just log in normally and the org appears
  const tokenForLink = result.user.passwordHash ? null : activationToken
  const inviteUrl = tokenForLink
    ? `${baseUrl}/auth/reset-password/${tokenForLink}?invite=1&org=${encodeURIComponent(orgName)}`
    : `${baseUrl}/business`

  let emailSent = true
  let emailError: string | null = null
  try {
    const tpl = gymOwnerInvite({
      name: result.user.name || ownerName,
      orgName,
      orgType,
      inviteUrl,
      inviterName: session.user.name || session.user.email || undefined,
    })
    await sendEmail({
      to: result.user.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    })
  } catch (err: any) {
    emailSent = false
    emailError = err?.message || 'unknown'
    console.error('Gym owner invite email failed:', err)
  }

  return NextResponse.json(
    {
      organization: {
        id: result.org.id,
        name: result.org.name,
        type: result.org.type,
        status: result.org.status,
      },
      owner: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        needsActivation: !result.user.passwordHash,
      },
      activationUrl: emailSent ? null : inviteUrl,
      emailSent,
      emailError,
    },
    { status: 201 }
  )
}
