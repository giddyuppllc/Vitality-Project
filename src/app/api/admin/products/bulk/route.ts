import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { setProductStatus } from '@/lib/products'
import type { ProductStatus } from '@prisma/client'
import { z } from 'zod'

const schema = z.object({
  ids: z.array(z.string()).min(1),
  action: z.enum([
    'status',
    'delete',
    'feature',
    'unfeature',
  ]),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { ids, action, payload } = schema.parse(await req.json())

    let result: { count: number } = { count: 0 }

    switch (action) {
      case 'status': {
        const status = payload?.status as ProductStatus | undefined
        if (!status || !['DRAFT', 'ACTIVE', 'ARCHIVED'].includes(status)) {
          return NextResponse.json(
            { error: 'Invalid status' },
            { status: 400 },
          )
        }
        // One status change per id, each writing its own AuditLog row +
        // AdminNotification (when ACTIVE → hidden). Sequential rather than
        // updateMany so each change is individually auditable.
        let changed = 0
        for (const id of ids) {
          const r = await setProductStatus(id, status, {
            userId: session.user.id,
            userEmail: session.user.email,
            source: `admin/products bulk.status`,
          })
          if (r.changed) changed++
        }
        result = { count: changed }
        break
      }
      case 'delete': {
        // Soft-delete = bulk archive, same path as status change above.
        let changed = 0
        for (const id of ids) {
          const r = await setProductStatus(id, 'ARCHIVED', {
            userId: session.user.id,
            userEmail: session.user.email,
            source: `admin/products bulk.delete (soft-delete)`,
          })
          if (r.changed) changed++
        }
        result = { count: changed }
        break
      }
      case 'feature':
      case 'unfeature': {
        result = await prisma.product.updateMany({
          where: { id: { in: ids } },
          data: { featured: action === 'feature' },
        })
        break
      }
    }

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: `product.bulk.${action}`,
      entityType: 'Product',
      metadata: { ids, payload },
    })

    return NextResponse.json({ ok: true, count: result.count })
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.issues }, { status: 400 })
    console.error('Bulk action error:', error)
    return NextResponse.json({ error: 'Bulk action failed' }, { status: 500 })
  }
}
