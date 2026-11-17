import { requireVipApi, vipJson } from '@/lib/vip/access'
import { unreadConversationCount } from '@/lib/vip/messages'

export const dynamic = 'force-dynamic'

/** GET /api/vip/messages/unread — conversations with unread messages (nav badge; polled). */
export async function GET() {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  return vipJson({ unread: await unreadConversationCount(gate.viewer.userId) })
}
