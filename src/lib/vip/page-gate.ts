import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getVipViewer, type VipGate, type VipViewer } from './access'

/**
 * Clubhouse admin pages (/admin/vip/*) call this first. The admin layout's
 * check is not enough on its own: for a client navigation Next renders only
 * the segments that changed, so a request that claims the admin layout is
 * already on screen gets the page's data without the layout running. Same
 * rule and same redirect as src/app/admin/layout.tsx.
 */
export async function requireAdminPage(): Promise<string> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') redirect('/auth/login')
  return session.user.id
}

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
