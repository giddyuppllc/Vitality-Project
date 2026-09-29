import { redirect } from 'next/navigation'
import { getVipViewer, type VipGate, type VipViewer } from './access'

/**
 * Page-level twin of requireVipApi(). Server components call this first; it
 * redirects instead of returning an error body.
 *   signed out            → /signin
 *   signed in, no access  → /  (public landing with the join hand-off)
 *   community-suspended   → /suspended (community pages only)
 */
export async function requireVipPage(gate: VipGate): Promise<VipViewer> {
  const viewer = await getVipViewer()
  if (!viewer) redirect('/signin')
  if (!viewer.isMember) redirect('/')
  if (gate === 'community' && viewer.suspended) redirect('/suspended')
  return viewer
}
