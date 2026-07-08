import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateUniqueTrainerCode } from '@/lib/trainer'

/**
 * GET /api/business/me
 * Returns the calling user's first OrgMember row + a join link.
 * Lazy-generates a referralCode for legacy members who don't have one yet.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let membership = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
    include: {
      organization: { select: { id: true, name: true, slug: true, status: true } },
      location: { select: { id: true, name: true } },
    },
    orderBy: { role: 'asc' }, // OWNER first if multi-membership
  })

  if (!membership) {
    return NextResponse.json({ error: 'You are not a member of any organization' }, { status: 403 })
  }

  // Backfill referralCode if it's missing (legacy member from before we
  // added auto-generation)
  if (!membership.referralCode) {
    const code = await generateUniqueTrainerCode(session.user.name || undefined)
    membership = await prisma.orgMember.update({
      where: { id: membership.id },
      data: { referralCode: code },
      include: {
        organization: { select: { id: true, name: true, slug: true, status: true } },
        location: { select: { id: true, name: true } },
      },
    })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vitalityproject.global'
  const joinUrl = `${baseUrl}/join/${membership.referralCode}`

  return NextResponse.json({
    id: membership.id,
    role: membership.role,
    referralCode: membership.referralCode,
    joinUrl,
    organization: membership.organization,
    location: membership.location,
  })
}
