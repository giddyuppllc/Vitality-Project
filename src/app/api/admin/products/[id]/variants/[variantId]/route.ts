import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { syncProductInventory, hasVariants } from '@/lib/product-stock'

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  sku: z.string().optional().nullable(),
  price: z.number().int().min(0).optional(),
  inventory: z.number().int().min(0).optional(),
})

async function guard() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return null
  return session
}

export async function PATCH(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; variantId: string }> },
) {
  if (!(await guard()))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, variantId } = await params
  try {
    const data = patchSchema.parse(await req.json())
    const variant = await prisma.productVariant.update({
      where: { id: variantId },
      data: {
        ...data,
        sku: data.sku === null ? null : data.sku,
      },
    })
    await syncProductInventory(id)
    return NextResponse.json(variant)
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.issues }, { status: 400 })
    console.error('Variant update error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; variantId: string }> },
) {
  if (!(await guard()))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, variantId } = await params
  try {
    await prisma.productVariant.delete({ where: { id: variantId } })
    await syncProductInventory(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Variant delete error:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
