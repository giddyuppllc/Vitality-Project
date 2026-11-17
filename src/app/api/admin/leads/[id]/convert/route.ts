import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { slugify } from '@/lib/utils'
import type { OrgType } from '@prisma/client'

const VALID_ORG_TYPES: OrgType[] = ['GYM', 'CLINIC', 'DOCTOR_OFFICE', 'OTHER']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const lead = await prisma.salesLead.findUnique({ where: { id } })
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }
    if (lead.organizationId) {
      return NextResponse.json(
        { error: 'Lead is already linked to an organization' },
        { status: 400 },
      )
    }

    const body = await req.json().catch(() => ({}))
    const type: OrgType = VALID_ORG_TYPES.includes(body?.type)
      ? body.type
      : 'OTHER'

    // Find or create user by contactEmail
    const email = lead.contactEmail.toLowerCase()
    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      // No password: approving the org (SUSPENDED -> ACTIVE) emails every
      // PASSWORDLESS owner an activation link. A random throwaway hash here
      // meant that email was skipped and the owner could never get in.
      user = await prisma.user.create({
        data: {
          email,
          name: lead.contactName,
          passwordHash: null,
          role: 'CUSTOMER',
        },
      })
    }

    // Block double-owners
    const existingOwnership = await prisma.orgMember.findFirst({
      where: { userId: user.id, role: 'OWNER' },
    })

    let organization
    if (existingOwnership) {
      organization = await prisma.organization.findUnique({
        where: { id: existingOwnership.organizationId },
      })
    } else {
      // Unique slug
      let slug = slugify(lead.businessName) || `org-${Date.now().toString(36)}`
      const clash = await prisma.organization.findUnique({ where: { slug } })
      if (clash) slug = `${slug}-${Date.now().toString(36)}`

      organization = await prisma.organization.create({
        data: {
          name: lead.businessName,
          slug,
          type,
          status: 'SUSPENDED',
        },
      })

      await prisma.orgMember.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: 'OWNER',
        },
      })
    }

    if (!organization) {
      return NextResponse.json(
        { error: 'Failed to resolve organization' },
        { status: 500 },
      )
    }

    const updated = await prisma.salesLead.update({
      where: { id },
      data: { organizationId: organization.id },
    })

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'lead.convert',
      entityType: 'SalesLead',
      entityId: id,
      metadata: {
        organizationId: organization.id,
        orgName: organization.name,
        reusedExistingOwner: !!existingOwnership,
      },
    })

    return NextResponse.json({
      lead: updated,
      organization,
      reusedExistingOwner: !!existingOwnership,
    })
  } catch (error) {
    console.error('Convert lead error:', error)
    return NextResponse.json(
      { error: 'Failed to convert lead' },
      { status: 500 },
    )
  }
}
