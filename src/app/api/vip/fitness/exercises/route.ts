import { NextRequest } from 'next/server'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { listExercises } from '@/lib/vip/fitness/exercises'

export const dynamic = 'force-dynamic'

/** GET ?q=&muscle=&equipment= — published exercises (the logger's "add exercise" picker). */
export async function GET(req: NextRequest) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const sp = req.nextUrl.searchParams
  const exercises = await listExercises({
    q: sp.get('q') ?? undefined,
    muscle: sp.get('muscle') ?? undefined,
    equipment: sp.get('equipment') ?? undefined,
  })
  return vipJson({ exercises })
}
