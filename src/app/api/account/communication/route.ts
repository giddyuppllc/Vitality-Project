import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const patchSchema = z.object({
  marketingEmail: z.boolean().optional(),
  sms: z.boolean().optional(),
  phoneContact: z.boolean().optional(),
})

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const prefs = await prisma.communicationPreference.findUnique({
    where: { userId: session.user.id },
  })

  return NextResponse.json(
    prefs ?? {
      userId: session.user.id,
      transactionalEmail: true,
      marketingEmail: true,
      sms: false,
      phoneContact: true,
    },
  )
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const data = patchSchema.parse(await req.json())

    const updated = await prisma.communicationPreference.upsert({
      where: { userId: session.user.id },
      update: data,
      create: {
        userId: session.user.id,
        transactionalEmail: true,
        marketingEmail: data.marketingEmail ?? true,
        sms: data.sms ?? false,
        phoneContact: data.phoneContact ?? true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Update comm prefs error:', error)
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
  }
}
