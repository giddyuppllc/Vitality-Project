import Link from 'next/link'
import { requireAdminPage } from '@/lib/vip/page-gate'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { logAudit } from '@/lib/audit'
import { AdminActionButton } from '@/components/admin/vip/admin-vip-ui'

export const dynamic = 'force-dynamic'

const M = '/api/admin/vip/moderation'

/**
 * A REPORTED conversation, read-only. The team cannot browse direct
 * messages: this page opens only when a participant has reported a message
 * in this conversation, and every view is written to the audit log.
 */
export default async function AdminVipConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const adminId = await requireAdminPage()
  const { id } = await params
  const reports = await prisma.vipReport.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: 'asc' },
    include: { reporter: { select: { email: true } } },
  })
  if (!reports.length) {
    return (
      <div className="glass rounded-2xl p-6 text-sm text-white/60">
        <p>This conversation has not been reported, so it can’t be opened. Direct messages are private to their participants.</p>
        <Link href="/admin/vip" className="mt-3 inline-block text-brand-300 hover:text-brand-200">← Moderation queue</Link>
      </div>
    )
  }
  const conv = await prisma.vipConversation.findUnique({
    where: { id },
    include: {
      participants: { include: { user: { select: { id: true, email: true, name: true } } } },
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 500,
        include: { sender: { select: { email: true } }, sharedPost: { select: { id: true, body: true } } },
      },
    },
  })
  if (!conv) {
    return <p className="glass rounded-2xl p-6 text-sm text-white/60">This conversation no longer exists.</p>
  }
  await logAudit({
    userId: adminId,
    action: 'vip.moderation.view_reported_conversation',
    entityType: 'VipConversation',
    entityId: id,
    metadata: { reportIds: reports.map((r) => r.id) },
  })
  const reported = new Set(reports.map((r) => r.messageId))

  return (
    <div className="space-y-6">
      <Link href="/admin/vip" className="text-sm text-brand-300 hover:text-brand-200">← Moderation queue</Link>
      <section className="glass space-y-2 rounded-2xl p-5 text-sm">
        <h2 className="text-lg font-semibold">Reported conversation{conv.title ? ` — ${conv.title}` : ''}</h2>
        <p className="text-white/60">
          {conv.isGroup ? 'Group' : '1:1'} · started {formatDate(conv.createdAt)} · participants:{' '}
          {conv.participants.map((p) => `${p.user.email}${p.leftAt ? ' (left)' : ''}`).join(', ')}
        </p>
        <ul className="space-y-1 pt-2">
          {reports.map((r) => (
            <li key={r.id} className="text-white/70">
              <span className="text-white/40">{formatDate(r.createdAt)} · {r.reporter.email} · {r.status.toLowerCase()}:</span> {r.reason}
            </li>
          ))}
        </ul>
      </section>

      <section className="glass rounded-2xl p-5">
        <h3 className="mb-3 font-semibold">Messages ({conv.messages.length})</h3>
        {conv.messages.length === 0 ? (
          <p className="text-sm text-white/40">No messages.</p>
        ) : (
          <ol className="space-y-2">
            {conv.messages.map((m) => (
              <li
                key={m.id}
                className={`rounded-xl p-3 text-sm ${reported.has(m.id) ? 'border border-amber-300/40 bg-amber-300/[0.06]' : 'bg-white/5'}`}
              >
                <p className="text-xs text-white/40">
                  {formatDate(m.createdAt)} · {m.sender.email}
                  {reported.has(m.id) && <span className="ml-2 font-semibold text-amber-200">reported</span>}
                </p>
                {m.body && <p className="mt-1 whitespace-pre-line text-white/85">{m.body}</p>}
                {m.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- admin-only media route
                  <img
                    src={`/api/admin/vip/media/${m.imageUrl.replace('/api/vip/media/', '')}?c=${conv.id}`}
                    alt="Photo sent in the conversation"
                    className="mt-2 max-h-64 rounded-lg border border-white/10"
                  />
                )}
                {m.sharedPost && (
                  <p className="mt-1 text-xs text-white/50">Shared post: {m.sharedPost.body.slice(0, 160)}</p>
                )}
                {reported.has(m.id) && (
                  <div className="mt-2">
                    <AdminActionButton
                      endpoint={M}
                      label="Suspend sender from community"
                      confirmText="Suspend this member from the community? They keep classroom, events and rewards."
                      body={{ action: 'suspend_member', userId: m.senderId }}
                      prompt={{ field: 'reason', question: 'Internal reason (optional)' }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
