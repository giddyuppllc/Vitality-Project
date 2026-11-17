import { notFound } from 'next/navigation'
import { requireVipPage } from '@/lib/vip/page-gate'
import { getConversation, listMessages, markRead } from '@/lib/vip/messages'
import { MessageThread } from '@/components/vip/message-thread'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Conversation' }

/** One conversation. Only its participants get anything but a 404. */
export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireVipPage('community')
  const { id } = await params
  const conversation = await getConversation(viewer, id)
  if (!conversation) notFound()
  const page = await listMessages(viewer, id)
  if (!page) notFound()
  await markRead(viewer, id)
  return (
    <MessageThread
      viewerId={viewer.userId}
      viewerName={viewer.displayName}
      initialConversation={conversation}
      initialMessages={page.messages}
      initialHasOlder={page.hasOlder}
    />
  )
}
