import { NextRequest } from 'next/server'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { deleteBodyMetric } from '@/lib/vip/fitness/health'

export const dynamic = 'force-dynamic'

/** DELETE — remove one of the member's OWN entries (anyone else's id is a 404). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { id } = await params
  const ok = await deleteBodyMetric(gate.viewer.userId, id)
  return ok ? vipJson({ ok: true }) : vipJson({ error: 'Not found' }, { status: 404 })
}
