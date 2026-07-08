import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const membership = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
  })

  if (!membership) {
    return NextResponse.json({ error: 'No organization found' }, { status: 403 })
  }

  return NextResponse.json(membership.organization)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const membership = await prisma.orgMember.findFirst({
    where: { userId: session.user.id, role: 'OWNER' },
  })

  if (!membership) {
    return NextResponse.json({ error: 'Only the owner can update settings' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { name } = body

    const data: Record<string, any> = {}
    if (name) data.name = name

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const updated = await prisma.organization.update({
      where: { id: membership.organizationId },
      data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update settings error:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
