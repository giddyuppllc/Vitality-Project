import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, MessageSquare } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function SupportPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth/login?callbackUrl=/account/support')

  const tickets = await prisma.supportTicket.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { messages: true } } },
  })

  const statusVariant = (s: string) =>
    s === 'RESOLVED' || s === 'CLOSED'
      ? 'success'
      : s === 'WAITING_CUSTOMER'
      ? 'warning'
      : 'info'

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Support</h1>
          <p className="text-white/40 mt-1">{tickets.length} tickets</p>
        </div>
        <Link href="/account/support/new">
          <Button>
            <Plus className="w-4 h-4" /> New Ticket
          </Button>
        </Link>
      </div>

      {tickets.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center">
          <MessageSquare className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">No tickets yet</h2>
          <p className="text-white/40 text-sm mb-6">
            Need help with an order or have a question? Open a ticket and a real
            person will reply within one business day.
          </p>
          <Link href="/account/support/new">
            <Button>Create your first ticket</Button>
          </Link>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 text-left">
                {['Ticket', 'Subject', 'Status', 'Messages', 'Updated'].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-5 py-4">
                    <Link
                      href={`/account/support/${t.id}`}
                      className="font-mono text-sm text-brand-400"
                    >
                      {t.number}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-sm font-medium">{t.subject}</td>
                  <td className="px-5 py-4">
                    <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
                  </td>
                  <td className="px-5 py-4 text-sm text-white/60">
                    {t._count.messages}
                  </td>
                  <td className="px-5 py-4 text-sm text-white/40">
                    {formatDate(t.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
