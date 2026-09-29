import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatDate, formatPrice } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, BarChart2, Mail, MessageSquare } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ status?: string }>
}

export default async function AdminCampaignsPage({ searchParams }: Props) {
  const { status } = await searchParams

  const where: Record<string, unknown> = {}
  if (
    status &&
    ['DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'PAUSED', 'CANCELLED'].includes(status)
  ) {
    where.status = status
  }

  const campaigns = await prisma.marketingCampaign.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      segment: { select: { id: true, name: true } },
    },
  })

  const statusVariant = (s: string) =>
    s === 'SENT'
      ? 'success'
      : s === 'SENDING'
      ? 'info'
      : s === 'SCHEDULED'
      ? 'info'
      : s === 'DRAFT'
      ? 'warning'
      : s === 'CANCELLED'
      ? 'danger'
      : 'default'

  const pct = (num: number, denom: number) => {
    if (!denom) return '—'
    return `${Math.round((num / denom) * 100)}%`
  }

  const filterTabs: Array<{ label: string; value: string | undefined }> = [
    { label: 'All', value: undefined },
    { label: 'Draft', value: 'DRAFT' },
    { label: 'Scheduled', value: 'SCHEDULED' },
    { label: 'Sent', value: 'SENT' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Marketing campaigns</h1>
          <p className="text-white/40 mt-1">
            {campaigns.length} campaign{campaigns.length === 1 ? '' : 's'} · email marketing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/campaigns/analytics">
            <Button variant="secondary">
              <BarChart2 className="w-4 h-4" /> Analytics
            </Button>
          </Link>
          <Link href="/admin/campaigns/new">
            <Button>
              <Plus className="w-4 h-4" /> New campaign
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {filterTabs.map((tab) => {
          const active = status === tab.value || (!status && !tab.value)
          const href = tab.value
            ? `/admin/campaigns?status=${tab.value}`
            : '/admin/campaigns'
          return (
            <Link
              key={tab.label}
              href={href}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
                  : 'text-white/50 hover:text-white hover:bg-white/5 border border-white/10'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left">
              {[
                'Name',
                'Channel',
                'Segment',
                'Status',
                'Recipients',
                'Opened',
                'Clicked',
                'Sent',
                'Revenue',
                '',
              ].map((h) => (
                <th
                  key={h}
                  className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {campaigns.map((c) => (
              <tr key={c.id} className="hover:bg-white/2 transition-colors">
                <td className="px-5 py-4">
                  <Link
                    href={`/admin/campaigns/${c.id}`}
                    className="font-medium text-white hover:text-brand-400 transition-colors"
                  >
                    {c.name}
                  </Link>
                  {c.subject && (
                    <p className="text-xs text-white/40 mt-0.5 truncate max-w-xs">
                      {c.subject}
                    </p>
                  )}
                </td>
                <td className="px-5 py-4">
                  <span className="inline-flex items-center gap-1.5 text-sm text-white/60">
                    {c.channel === 'EMAIL' ? (
                      <Mail className="w-3.5 h-3.5" />
                    ) : (
                      <MessageSquare className="w-3.5 h-3.5" />
                    )}
                    {c.channel}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm text-white/60">
                  {c.segment?.name ?? <span className="text-white/30">All customers</span>}
                </td>
                <td className="px-5 py-4">
                  <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                </td>
                <td className="px-5 py-4 text-sm">{c.recipientCount.toLocaleString()}</td>
                <td className="px-5 py-4 text-sm">
                  <span>{c.openedCount.toLocaleString()}</span>
                  <span className="text-white/40 ml-1">({pct(c.openedCount, c.deliveredCount)})</span>
                </td>
                <td className="px-5 py-4 text-sm">
                  <span>{c.clickedCount.toLocaleString()}</span>
                  <span className="text-white/40 ml-1">({pct(c.clickedCount, c.deliveredCount)})</span>
                </td>
                <td className="px-5 py-4 text-sm text-white/60">
                  {c.sentAt ? formatDate(c.sentAt) : '—'}
                </td>
                <td className="px-5 py-4 text-sm font-medium">
                  {c.revenueCents > 0 ? formatPrice(c.revenueCents) : <span className="text-white/30">—</span>}
                </td>
                <td className="px-5 py-4">
                  <Link
                    href={`/admin/campaigns/${c.id}`}
                    className="text-brand-400 text-xs hover:underline"
                  >
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={10} className="px-5 py-16 text-center text-white/30 text-sm">
                  No campaigns yet.{' '}
                  <Link href="/admin/campaigns/new" className="text-brand-400">
                    Create one
                  </Link>
                  .
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
