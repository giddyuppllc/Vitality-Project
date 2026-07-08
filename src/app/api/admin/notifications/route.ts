import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const notifications = await prisma.adminNotification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const userId = session.user.id
  const unread = notifications.filter((n) => !n.readBy.includes(userId)).length

  return NextResponse.json({
    notifications: notifications.map((n) => ({
      ...n,
      read: n.readBy.includes(userId),
    })),
    unread,
  })
}

const patchSchema = z.object({
  id: z.string().optional(),
  all: z.boolean().optional(),
})

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  try {
    const { id, all } = patchSchema.parse(await req.json())

    if (all) {
      // Mark all as read for this admin
      const all = await prisma.adminNotification.findMany({
        where: { NOT: { readBy: { has: userId } } },
        select: { id: true, readBy: true },
      })
      await Promise.all(
        all.map((n) =>
          prisma.adminNotification.update({
            where: { id: n.id },
            data: { readBy: { set: [...n.readBy, userId] } },
          }),
        ),
      )
      return NextResponse.json({ ok: true, count: all.length })
    }

    if (id) {
      const n = await prisma.adminNotification.findUnique({ where: { id } })
      if (!n) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (!n.readBy.includes(userId)) {
        await prisma.adminNotification.update({
          where: { id },
          data: { readBy: { set: [...n.readBy, userId] } },
        })
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Missing id or all flag' }, { status: 400 })
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.issues }, { status: 400 })
    console.error('Notifications patch error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
