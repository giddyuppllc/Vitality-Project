import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { sendEmail } from '@/lib/email'
import { staffInvite } from '@/lib/email-templates'
import { generateUniqueTrainerCode } from '@/lib/trainer'

async function getOwnerOrAdmin(userId: string) {
  return prisma.orgMember.findFirst({
    where: { userId, role: { in: ['OWNER', 'ADMIN'] } },
    include: { organization: { select: { id: true, name: true } } },
  })
}

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const membership = await getOwnerOrAdmin(session.user.id)
  if (!membership) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const members = await prisma.orgMember.findMany({
    where: { organizationId: membership.organizationId },
    include: {
      user: { select: { name: true, email: true } },
      location: { select: { name: true } },
    },
    orderBy: { role: 'asc' },
  })

  return NextResponse.json(members)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const membership = await getOwnerOrAdmin(session.user.id)
  if (!membership) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { name, email, role } = body

    if (!name || !email || !role) {
      return NextResponse.json({ error: 'Name, email, and role are required' }, { status: 400 })
    }

    const validRoles = ['ADMIN', 'STAFF', 'COACH', 'DOCTOR']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Find or create user. New / passwordless users get an invite token so
    // they can set their own password — no plaintext credentials, no
    // unrecoverable random password lock-in.
    let user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    let needsActivation = false
    let activationToken: string | null = null

    if (!user) {
      // Brand-new user — create with passwordHash=null + invite token
      needsActivation = true
      activationToken = randomBytes(32).toString('hex')
      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          name,
          passwordHash: null,
          role: 'CUSTOMER',
          resetToken: activationToken,
          resetTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      })
    } else if (!user.passwordHash) {
      // Existing user (e.g. customer who shopped as a guest) but no password
      // — issue them an invite token to set one
      needsActivation = true
      activationToken = randomBytes(32).toString('hex')
      await prisma.user.update({
        where: { id: user.id },
        data: {
          name: user.name ?? name,
          resetToken: activationToken,
          resetTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      })
    }

    // Check if already a member
    const existing = await prisma.orgMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: membership.organizationId,
          userId: user.id,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'This person is already a member of your organization' },
        { status: 400 }
      )
    }

    // Auto-generate a personal referral code so the new member can attribute
    // customer signups to themselves via /join/<code>. Ownerless ADMINs get
    // codes too — gives them a working invite link without an extra step.
    const referralCode = await generateUniqueTrainerCode(name)

    const member = await prisma.orgMember.create({
      data: {
        organizationId: membership.organizationId,
        userId: user.id,
        role: role as any,
        referralCode,
      },
    })

    // Send the invite email (fire-and-forget so the response returns fast)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vitalityproject.global'
    const inviteUrl = activationToken
      ? `${baseUrl}/auth/reset-password/${activationToken}?invite=1&org=${encodeURIComponent(membership.organization.name)}`
      : `${baseUrl}/auth/login?org=${encodeURIComponent(membership.organization.name)}`

    void (async () => {
      try {
        const tpl = staffInvite({
          name: user!.name || name,
          orgName: membership.organization.name,
          inviteUrl,
        })
        await sendEmail({
          to: user!.email,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
        })
      } catch (err) {
        console.error('Staff invite email failed:', err)
      }
    })()

    return NextResponse.json(
      {
        ...member,
        needsActivation,
        // Surface the activation link in the response so the caller's UI can
        // show it as a fallback if the email doesn't arrive
        activationUrl: needsActivation ? inviteUrl : null,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Invite staff error:', error)
    return NextResponse.json({ error: 'Failed to invite staff' }, { status: 500 })
  }
}
