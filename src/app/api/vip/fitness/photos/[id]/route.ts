import { NextRequest, NextResponse } from 'next/server'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { deleteProgressPhoto, readProgressPhoto } from '@/lib/vip/fitness/photos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * GET — the photo, to the member who took it. Everyone else (other members,
 * admins, signed-out visitors) gets the same 404 as a photo that doesn't exist.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { id } = await params
  const bytes = await readProgressPhoto(id, gate.viewer.userId)
  if (!bytes) return vipJson({ error: 'Not found' }, { status: 404 })
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'image/jpeg',
      // Owner-only: never shared caches, and not kept by the browser either.
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { id } = await params
  const ok = await deleteProgressPhoto(id, gate.viewer.userId)
  return ok ? vipJson({ ok: true }) : vipJson({ error: 'Not found' }, { status: 404 })
}
