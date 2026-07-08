import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return null
  return session
}

const createSchema = z.object({
  name: z.string().min(1).max(80),
  countries: z.array(z.string().length(2)).min(1),
  active: z.boolean().optional(),
})

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const zones = await prisma.shippingZone.findMany({
    include: { rates: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(zones)
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const data = createSchema.parse(await req.json())
    const zone = await prisma.shippingZone.create({
      data: {
        name: data.name.trim(),
        countries: data.countries.map((c) => c.toUpperCase()),
        active: data.active ?? true,
      },
    })
    return NextResponse.json(zone, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 })
    }
    console.error('[admin/shipping/zones POST]', err)
    return NextResponse.json({ error: 'Create failed' }, { status: 500 })
  }
}
