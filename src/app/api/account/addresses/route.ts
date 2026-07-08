import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const addressSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  line1: z.string().min(1, 'Address line 1 is required'),
  line2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zip: z.string().min(1, 'ZIP code is required'),
  country: z.string().default('US'),
  phone: z.string().optional(),
  isDefault: z.boolean().optional(),
})

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const addresses = await prisma.address.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: 'desc' }, { id: 'desc' }],
  })

  return NextResponse.json(addresses)
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = addressSchema.parse(body)

    // If setting as default, unset existing default
    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userId: session.user.id, isDefault: true },
        data: { isDefault: false },
      })
    }

    // If it's the first address, make it default
    const count = await prisma.address.count({ where: { userId: session.user.id } })
    const isDefault = data.isDefault ?? count === 0

    const address = await prisma.address.create({
      data: {
        userId: session.user.id,
        name: data.name,
        line1: data.line1,
        line2: data.line2 ?? null,
        city: data.city,
        state: data.state,
        zip: data.zip,
        country: data.country,
        phone: data.phone ?? null,
        isDefault,
      },
    })

    return NextResponse.json(address, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Address create error:', error)
    return NextResponse.json({ error: 'Failed to create address' }, { status: 500 })
  }
}
