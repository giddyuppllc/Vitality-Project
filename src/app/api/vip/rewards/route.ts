import { requireVipApi, vipJson } from '@/lib/vip/access'
import { getRewardsSummary } from '@/lib/vip/rewards-view'

export const dynamic = 'force-dynamic'

/** GET /api/vip/rewards — the viewer's store-credit balance + history. */
export async function GET() {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  return vipJson(await getRewardsSummary(gate.viewer))
}
