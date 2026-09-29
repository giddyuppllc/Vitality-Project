import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft } from 'lucide-react'
import { TicketAdminPanel } from '@/components/admin/ticket-admin-panel'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminTicketDetailPage({ params }: Props) {
  const { id } = await params
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      user: { select: { id: true, name: true, email: true } },
    },
  })
  if (!ticket) notFound()

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })

  const statusVariant = (s: string) =>
    s === 'RESOLVED' || s === 'CLOSED'
      ? 'success'
      : s === 'WAITING_CUSTOMER'
      ? 'warning'
      : 'info'

  const priorityVariant = (p: string) =>
    p === 'URGENT' ? 'danger' : p === 'HIGH' ? 'warning' : 'default'

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin/support"
          className="text-white/40 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{ticket.subject}</h1>
            <Badge variant={statusVariant(ticket.status)}>
              {ticket.status}
            </Badge>
            <Badge variant={priorityVariant(ticket.priority)}>
              {ticket.priority}
            </Badge>
          </div>
          <p className="text-white/40 text-sm mt-0.5 font-mono">
            {ticket.number} · {ticket.email}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Thread */}
        <div className="lg:col-span-2 space-y-4">
          {ticket.messages.map((m) => {
            const fromCustomer =
              m.authorId === ticket.userId || m.authorId === null
            return (
              <div
                key={m.id}
                className={`glass rounded-2xl p-5 ${
                  m.internal
                    ? 'border border-amber-400/30 bg-amber-500/5'
                    : fromCustomer
                    ? ''
                    : 'border border-brand-500/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white/80">
                      {m.authorName}
                    </span>
                    {m.internal && (
                      <Badge variant="warning">Internal</Badge>
                    )}
                  </div>
                  <span className="text-white/30">
                    {formatDate(m.createdAt)}
                  </span>
                </div>
                <p className="text-white/70 text-sm whitespace-pre-wrap leading-relaxed">
                  {m.body}
                </p>
              </div>
            )
          })}
        </div>

        {/* Admin Panel */}
        <div>
          <TicketAdminPanel
            ticketId={ticket.id}
            initialStatus={ticket.status}
            initialPriority={ticket.priority}
            initialAssignedTo={ticket.assignedTo}
            admins={admins}
          />
        </div>
      </div>
    </div>
  )
}
