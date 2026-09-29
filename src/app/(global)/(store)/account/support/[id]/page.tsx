import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft } from 'lucide-react'
import { TicketReplyForm } from '@/components/store/ticket-reply-form'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function TicketPage({ params }: Props) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth/login')

  const { id } = await params
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      messages: {
        where: { internal: false },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!ticket || ticket.userId !== session.user.id) notFound()

  const statusVariant = (s: string) =>
    s === 'RESOLVED' || s === 'CLOSED'
      ? 'success'
      : s === 'WAITING_CUSTOMER'
      ? 'warning'
      : 'info'

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/account/support"
          className="text-white/40 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{ticket.subject}</h1>
            <Badge variant={statusVariant(ticket.status)}>
              {ticket.status}
            </Badge>
          </div>
          <p className="text-white/40 text-sm mt-0.5 font-mono">
            {ticket.number}
          </p>
        </div>
      </div>

      <div className="max-w-3xl space-y-4">
        {ticket.messages.map((m) => {
          const isStaff = m.authorId === null ? false : undefined
          // Heuristic: treat messages with no authorId as customer-authored (guest/customer).
          // Messages with authorId could be either — but without role info here,
          // we style them the same way. Admin-authored replies are shown styled differently below.
          const fromCustomer = m.authorId === ticket.userId || m.authorId === null
          return (
            <div
              key={m.id}
              className={`glass rounded-2xl p-5 ${
                fromCustomer ? '' : 'border border-brand-500/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2 text-xs">
                <span className="font-semibold text-white/80">
                  {fromCustomer ? 'You' : m.authorName}
                </span>
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

        {ticket.status !== 'CLOSED' && <TicketReplyForm ticketId={ticket.id} />}
      </div>
    </div>
  )
}
