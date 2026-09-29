export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { formatDate, formatPrice } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { LEAD_PRIORITIES, LEAD_STAGES } from '@/components/admin/lead-constants'
import { LeadDetailEditor } from '@/components/admin/lead-detail-editor'
import { LeadActions } from '@/components/admin/lead-actions'
import {
  UserSquare,
  Clock,
  Building2,
  ArrowRight,
} from 'lucide-react'

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const lead = await prisma.salesLead.findUnique({ where: { id } })
  if (!lead) notFound()

  const [admins, org, activity] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, email: true, name: true },
      orderBy: { email: 'asc' },
    }),
    lead.organizationId
      ? prisma.organization.findUnique({ where: { id: lead.organizationId } })
      : null,
    prisma.auditLog.findMany({
      where: { entityType: 'SalesLead', entityId: lead.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])

  const stageMeta = LEAD_STAGES.find((s) => s.key === lead.stage)
  const priorityMeta = LEAD_PRIORITIES.find((p) => p.key === lead.priority)

  const editorLead = {
    id: lead.id,
    businessName: lead.businessName,
    contactName: lead.contactName,
    contactEmail: lead.contactEmail,
    contactPhone: lead.contactPhone,
    source: lead.source,
    stage: lead.stage,
    priority: lead.priority,
    estimatedValue: lead.estimatedValue,
    probability: lead.probability,
    assignedTo: lead.assignedTo,
    notes: lead.notes,
    nextAction: lead.nextAction,
    nextActionDue: lead.nextActionDue
      ? lead.nextActionDue.toISOString()
      : null,
    closedReason: lead.closedReason,
    organizationId: lead.organizationId,
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/leads"
          className="text-xs text-white/40 hover:text-white mb-2 inline-flex items-center gap-1"
        >
          <ArrowRight className="w-3 h-3 rotate-180" /> Back to pipeline
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <UserSquare className="w-6 h-6 text-brand-400" />
              <h1 className="text-2xl font-bold">{lead.businessName}</h1>
              {stageMeta && (
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${stageMeta.color}`}
                >
                  {stageMeta.label}
                </span>
              )}
              {priorityMeta && (
                <Badge variant={priorityMeta.badge}>{priorityMeta.label}</Badge>
              )}
            </div>
            <p className="text-white/40 text-sm">
              {lead.contactName} &middot; {lead.contactEmail}
              {lead.contactPhone ? ` · ${lead.contactPhone}` : ''}
            </p>
            <p className="text-white/30 text-xs mt-1">
              Created {formatDate(lead.createdAt)} · Updated{' '}
              {formatDate(lead.updatedAt)}
              {lead.closedAt ? ` · Closed ${formatDate(lead.closedAt)}` : ''}
            </p>
          </div>
          <LeadActions
            leadId={lead.id}
            hasOrganization={!!lead.organizationId}
            currentStage={lead.stage}
          />
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass rounded-2xl p-4">
          <p className="text-xs text-white/40 mb-1">Estimated value</p>
          <p className="text-xl font-bold text-emerald-400">
            {lead.estimatedValue != null
              ? formatPrice(lead.estimatedValue)
              : '—'}
          </p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-xs text-white/40 mb-1">Probability</p>
          <p className="text-xl font-bold">
            {lead.probability != null ? `${lead.probability}%` : '—'}
          </p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-xs text-white/40 mb-1">Weighted value</p>
          <p className="text-xl font-bold text-brand-400">
            {lead.estimatedValue != null && lead.probability != null
              ? formatPrice(
                  Math.round((lead.estimatedValue * lead.probability) / 100),
                )
              : '—'}
          </p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-xs text-white/40 mb-1">Source</p>
          <p className="text-sm font-medium">{lead.source || '—'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: edit form */}
        <div className="lg:col-span-2">
          <LeadDetailEditor lead={editorLead} admins={admins} />
        </div>

        {/* Right: timeline + org */}
        <div className="space-y-6">
          {org ? (
            <div className="glass rounded-2xl p-5">
              <h2 className="font-semibold mb-2 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand-400" />
                Linked Organization
              </h2>
              <p className="text-sm font-medium">{org.name}</p>
              <p className="text-xs text-white/40 mt-0.5">{org.slug}</p>
              <div className="mt-2">
                <Badge variant={org.status === 'ACTIVE' ? 'success' : 'warning'}>
                  {org.status === 'SUSPENDED' ? 'PENDING' : org.status}
                </Badge>
              </div>
              <Link
                href={`/admin/organizations/${org.id}`}
                className="mt-3 inline-block text-xs text-brand-400 hover:underline"
              >
                View organization →
              </Link>
            </div>
          ) : (
            <div className="glass rounded-2xl p-5">
              <h2 className="font-semibold mb-2 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-white/40" />
                No Organization
              </h2>
              <p className="text-xs text-white/40">
                This lead is not yet linked to an Organization. Use
                &quot;Convert to Organization&quot; above when they are ready
                to onboard.
              </p>
            </div>
          )}

          <div className="glass rounded-2xl p-5">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-400" /> Activity
            </h2>
            <ul className="space-y-3">
              {activity.length === 0 && (
                <li className="text-xs text-white/30">No activity yet.</li>
              )}
              {activity.map((a) => {
                let meta: any = null
                try {
                  meta = a.metadata ? JSON.parse(a.metadata) : null
                } catch {
                  meta = null
                }
                return (
                  <li
                    key={a.id}
                    className="border-l border-white/10 pl-3 py-0.5"
                  >
                    <p className="text-xs font-medium text-white/80">
                      {formatAction(a.action, meta)}
                    </p>
                    <p className="text-[11px] text-white/40">
                      {a.userEmail || 'system'} ·{' '}
                      {new Date(a.createdAt).toLocaleString()}
                    </p>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatAction(action: string, meta: any): string {
  switch (action) {
    case 'lead.create':
      return 'Lead created'
    case 'lead.stage.change':
      return `Stage changed: ${meta?.from ?? '?'} → ${meta?.to ?? '?'}`
    case 'lead.convert':
      return `Converted to Organization${meta?.orgName ? ` — ${meta.orgName}` : ''}`
    case 'lead.delete':
      return 'Lead deleted'
    case 'lead.update':
      return `Lead updated${
        meta?.keys?.length ? ` (${meta.keys.join(', ')})` : ''
      }`
    default:
      return action
  }
}
