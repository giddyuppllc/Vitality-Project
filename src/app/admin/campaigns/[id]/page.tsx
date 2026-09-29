import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatDate, formatPrice } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Mail,
  MailOpen,
  MousePointerClick,
  AlertTriangle,
  Users,
  DollarSign,
  Target,
} from 'lucide-react'
import { CampaignBuilder } from '@/components/admin/campaign-builder'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CampaignDetailPage({ params }: Props) {
  const { id } = await params
  const session = await getServerSession(authOptions)

  const campaign = await prisma.marketingCampaign.findUnique({
    where: { id },
    include: {
      segment: { select: { id: true, name: true } },
    },
  })
  if (!campaign) notFound()

  const segments = await prisma.savedSegment.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
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

  const isSent = campaign.status === 'SENT'

  // If sent, load recipient list from OutboundMessage
  let messages: Array<{
    id: string
    toEmail: string | null
    status: string
    openedAt: Date | null
    clickedAt: Date | null
    bouncedAt: Date | null
    createdAt: Date
  }> = []
  if (isSent) {
    messages = await prisma.outboundMessage.findMany({
      where: { campaignId: id },
      select: {
        id: true,
        toEmail: true,
        status: true,
        openedAt: true,
        clickedAt: true,
        bouncedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })
  }

  const pct = (num: number, denom: number) => {
    if (!denom) return '0%'
    return `${Math.round((num / denom) * 100)}%`
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin/campaigns"
          className="text-white/40 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <Badge variant={statusVariant(campaign.status)}>{campaign.status}</Badge>
          </div>
          <p className="text-white/40 text-sm mt-0.5">
            {campaign.channel} · {campaign.segment?.name ?? 'All customers'}{' '}
            {campaign.sentAt && `· Sent ${formatDate(campaign.sentAt)}`}
          </p>
        </div>
      </div>

      {isSent ? (
        <>
          {/* Analytics */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            {[
              {
                label: 'Recipients',
                value: campaign.recipientCount.toLocaleString(),
                icon: Users,
                color: 'text-brand-400',
              },
              {
                label: 'Delivered',
                value: campaign.deliveredCount.toLocaleString(),
                icon: Mail,
                color: 'text-blue-400',
              },
              {
                label: 'Opened',
                value: `${campaign.openedCount.toLocaleString()} (${pct(
                  campaign.openedCount,
                  campaign.deliveredCount,
                )})`,
                icon: MailOpen,
                color: 'text-emerald-400',
              },
              {
                label: 'Clicked',
                value: `${campaign.clickedCount.toLocaleString()} (${pct(
                  campaign.clickedCount,
                  campaign.deliveredCount,
                )})`,
                icon: MousePointerClick,
                color: 'text-purple-400',
              },
              {
                label: 'Bounced',
                value: campaign.bouncedCount.toLocaleString(),
                icon: AlertTriangle,
                color: 'text-amber-400',
              },
              {
                label: 'Revenue',
                value: formatPrice(campaign.revenueCents),
                icon: DollarSign,
                color: 'text-emerald-400',
                sub: `${campaign.conversions} conversions`,
              },
            ].map((stat) => (
              <div key={stat.label} className="glass rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/40">{stat.label}</span>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div className="text-lg font-bold">{stat.value}</div>
                {stat.sub && <div className="text-xs text-white/30 mt-1">{stat.sub}</div>}
              </div>
            ))}
          </div>

          <div className="glass rounded-2xl p-6 mb-6">
            <h2 className="font-semibold text-white/80 mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-brand-400" /> Campaign details
            </h2>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-white/40 mb-1">Subject</dt>
                <dd className="text-white">{campaign.subject || '—'}</dd>
              </div>
              <div>
                <dt className="text-white/40 mb-1">Sent at</dt>
                <dd className="text-white">
                  {campaign.sentAt ? formatDate(campaign.sentAt) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-white/40 mb-1">Segment</dt>
                <dd className="text-white">
                  {campaign.segment?.name ?? 'All customers'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5">
              <h2 className="font-semibold text-white/80">
                Recipients ({messages.length.toLocaleString()})
              </h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 text-left">
                  {['Email', 'Status', 'Opened', 'Clicked', 'Sent'].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {messages.map((m) => (
                  <tr key={m.id} className="hover:bg-white/2 transition-colors">
                    <td className="px-5 py-3 text-sm font-mono">{m.toEmail ?? '—'}</td>
                    <td className="px-5 py-3">
                      <Badge
                        variant={
                          m.status === 'FAILED' || m.status === 'BOUNCED'
                            ? 'danger'
                            : m.status === 'CLICKED'
                            ? 'success'
                            : m.status === 'OPENED'
                            ? 'info'
                            : 'default'
                        }
                      >
                        {m.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-sm text-white/60">
                      {m.openedAt ? formatDate(m.openedAt) : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-white/60">
                      {m.clickedAt ? formatDate(m.clickedAt) : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-white/60">
                      {formatDate(m.createdAt)}
                    </td>
                  </tr>
                ))}
                {messages.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-white/30 text-sm">
                      No recipient records for this campaign.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <CampaignBuilder
          mode="edit"
          id={id}
          segments={segments}
          initialStatus={campaign.status}
          adminEmail={session?.user?.email ?? null}
        />
      )}
    </div>
  )
}
