'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { LayoutGrid, List, Calendar, Circle } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { LEAD_PRIORITIES, LEAD_SOURCES, LEAD_STAGES } from './lead-constants'
import { LeadStageSelect } from './lead-stage-select'

interface LeadRow {
  id: string
  businessName: string
  contactName: string
  contactEmail: string
  contactPhone: string | null
  source: string | null
  stage: string
  priority: string
  estimatedValue: number | null
  probability: number | null
  assignedTo: string | null
  nextAction: string | null
  nextActionDue: string | null
  notes: string | null
  organizationId: string | null
  closedAt: string | null
  updatedAt: string
}

interface AdminInfo {
  id: string
  email: string
  name: string | null
}

interface LeadsBoardProps {
  leads: LeadRow[]
  admins: AdminInfo[]
}

export function LeadsBoard({ leads, admins }: LeadsBoardProps) {
  const [view, setView] = useState<'kanban' | 'table'>('kanban')
  const [assignee, setAssignee] = useState<string>('all')
  const [priority, setPriority] = useState<string>('all')
  const [source, setSource] = useState<string>('all')
  const [q, setQ] = useState('')
  const [showClosedWonList, setShowClosedWonList] = useState(false)
  const [showClosedLostList, setShowClosedLostList] = useState(false)

  const adminById = useMemo(() => {
    const m = new Map<string, AdminInfo>()
    admins.forEach((a) => m.set(a.id, a))
    return m
  }, [admins])

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (assignee !== 'all') {
        if (assignee === 'unassigned' && l.assignedTo) return false
        if (assignee !== 'unassigned' && l.assignedTo !== assignee) return false
      }
      if (priority !== 'all' && l.priority !== priority) return false
      if (source !== 'all' && l.source !== source) return false
      if (q) {
        const needle = q.toLowerCase()
        if (
          !l.businessName.toLowerCase().includes(needle) &&
          !l.contactName.toLowerCase().includes(needle) &&
          !l.contactEmail.toLowerCase().includes(needle)
        ) {
          return false
        }
      }
      return true
    })
  }, [leads, assignee, priority, source, q])

  const byStage = useMemo(() => {
    const m = new Map<string, LeadRow[]>()
    LEAD_STAGES.forEach((s) => m.set(s.key, []))
    for (const lead of filtered) {
      if (!m.has(lead.stage)) m.set(lead.stage, [])
      m.get(lead.stage)!.push(lead)
    }
    return m
  }, [filtered])

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search business, contact, email…"
          className="px-3 py-2 rounded-xl bg-dark-700 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500 w-72"
        />
        <select
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          className="px-3 py-2 rounded-xl bg-dark-700 border border-white/10 text-sm text-white/80 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="all">All assignees</option>
          <option value="unassigned">Unassigned</option>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name || a.email}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="px-3 py-2 rounded-xl bg-dark-700 border border-white/10 text-sm text-white/80 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="all">All priorities</option>
          {LEAD_PRIORITIES.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="px-3 py-2 rounded-xl bg-dark-700 border border-white/10 text-sm text-white/80 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="all">All sources</option>
          {LEAD_SOURCES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-xl border border-white/10 overflow-hidden">
            <button
              onClick={() => setView('kanban')}
              className={`px-3 py-2 text-xs flex items-center gap-1.5 ${
                view === 'kanban'
                  ? 'bg-brand-500/20 text-brand-400'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Kanban
            </button>
            <button
              onClick={() => setView('table')}
              className={`px-3 py-2 text-xs flex items-center gap-1.5 ${
                view === 'table'
                  ? 'bg-brand-500/20 text-brand-400'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" /> Table
            </button>
          </div>
          <Link
            href="/admin/leads/new"
            className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium shadow-lg shadow-brand-500/25 transition-colors"
          >
            + New Lead
          </Link>
          <Link
            href="/admin/leads/import"
            className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-white/70 text-sm font-medium transition-colors"
          >
            Import CSV
          </Link>
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {LEAD_STAGES.map((stage) => {
            const items = byStage.get(stage.key) ?? []
            const totalValue = items.reduce(
              (sum, l) => sum + (l.estimatedValue ?? 0),
              0,
            )
            const isClosed =
              stage.key === 'CLOSED_WON' || stage.key === 'CLOSED_LOST'
            const showList =
              stage.key === 'CLOSED_WON'
                ? showClosedWonList
                : stage.key === 'CLOSED_LOST'
                  ? showClosedLostList
                  : true

            return (
              <div
                key={stage.key}
                className="glass rounded-2xl p-3 shrink-0 w-72"
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${stage.color}`}
                    >
                      {stage.label}
                    </span>
                    <button
                      onClick={() => {
                        if (stage.key === 'CLOSED_WON')
                          setShowClosedWonList((v) => !v)
                        if (stage.key === 'CLOSED_LOST')
                          setShowClosedLostList((v) => !v)
                      }}
                      className={`text-xs text-white/50 ${
                        isClosed ? 'underline hover:text-white cursor-pointer' : ''
                      }`}
                      disabled={!isClosed}
                    >
                      {items.length}
                    </button>
                  </div>
                  {totalValue > 0 && (
                    <span className="text-[10px] text-white/40">
                      {formatPrice(totalValue)}
                    </span>
                  )}
                </div>

                <div className="space-y-2 min-h-[4rem]">
                  {(!isClosed || showList) &&
                    items.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        admin={
                          lead.assignedTo
                            ? adminById.get(lead.assignedTo)
                            : undefined
                        }
                      />
                    ))}
                  {items.length === 0 && (
                    <div className="text-[11px] text-white/25 text-center py-4">
                      No leads
                    </div>
                  )}
                  {isClosed && !showList && items.length > 0 && (
                    <button
                      onClick={() => {
                        if (stage.key === 'CLOSED_WON')
                          setShowClosedWonList(true)
                        if (stage.key === 'CLOSED_LOST')
                          setShowClosedLostList(true)
                      }}
                      className="w-full text-xs text-white/40 hover:text-white py-2 border border-dashed border-white/10 rounded-lg"
                    >
                      Show {items.length} closed
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <LeadsTable leads={filtered} adminById={adminById} />
      )}
    </div>
  )
}

function LeadCard({
  lead,
  admin,
}: {
  lead: LeadRow
  admin?: AdminInfo
}) {
  const priorityMeta = LEAD_PRIORITIES.find((p) => p.key === lead.priority)
  const overdue =
    lead.nextActionDue && new Date(lead.nextActionDue).getTime() < Date.now()
  const isAffiliateApp = lead.source === 'affiliate_application'

  return (
    <div className="bg-dark-700/60 border border-white/5 rounded-xl p-3 hover:border-white/15 transition-colors">
      <Link href={`/admin/leads/${lead.id}`} className="block">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-semibold text-white leading-tight truncate">
            {lead.businessName}
          </p>
          {priorityMeta && priorityMeta.key !== 'NORMAL' && (
            <Badge variant={priorityMeta.badge} className="shrink-0 text-[10px]">
              {priorityMeta.label}
            </Badge>
          )}
        </div>
        {isAffiliateApp && (
          <span className="inline-flex items-center gap-1 mb-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand-500/15 text-brand-300">
            Affiliate application
          </span>
        )}
        <p className="text-[11px] text-white/50 truncate">
          {lead.contactName} · {lead.contactEmail}
        </p>
        {lead.estimatedValue != null && lead.estimatedValue > 0 && (
          <p className="text-xs text-emerald-400 font-medium mt-1.5">
            {formatPrice(lead.estimatedValue)}
            {lead.probability != null ? ` · ${lead.probability}%` : ''}
          </p>
        )}
        {lead.nextAction && (
          <div
            className={`mt-2 flex items-center gap-1.5 text-[11px] ${
              overdue ? 'text-red-400' : 'text-white/50'
            }`}
          >
            <Calendar className="w-3 h-3 shrink-0" />
            <span className="truncate">{lead.nextAction}</span>
            {lead.nextActionDue && (
              <span className="shrink-0">
                · {new Date(lead.nextActionDue).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
        {admin && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-white/40">
            <Circle className="w-2 h-2 fill-brand-500 text-brand-500" />
            <span className="truncate">{admin.name || admin.email}</span>
          </div>
        )}
      </Link>
      {isAffiliateApp && (
        <Link
          href="/admin/affiliates"
          className="mt-2 inline-block text-[11px] text-brand-400 hover:text-brand-300"
        >
          Review &amp; approve in Affiliates →
        </Link>
      )}
      <div className="mt-2">
        <LeadStageSelect leadId={lead.id} currentStage={lead.stage} />
      </div>
    </div>
  )
}

function LeadsTable({
  leads,
  adminById,
}: {
  leads: LeadRow[]
  adminById: Map<string, AdminInfo>
}) {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/5 text-left">
            <th className="px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">
              Business
            </th>
            <th className="px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">
              Contact
            </th>
            <th className="px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">
              Stage
            </th>
            <th className="px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">
              Priority
            </th>
            <th className="px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">
              Value
            </th>
            <th className="px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">
              Assignee
            </th>
            <th className="px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">
              Next Action
            </th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {leads.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-white/30 text-sm">
                No leads match your filters
              </td>
            </tr>
          )}
          {leads.map((lead) => {
            const admin = lead.assignedTo ? adminById.get(lead.assignedTo) : undefined
            const stage = LEAD_STAGES.find((s) => s.key === lead.stage)
            const priority = LEAD_PRIORITIES.find((p) => p.key === lead.priority)
            return (
              <tr key={lead.id} className="hover:bg-white/2 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/leads/${lead.id}`}
                    className="text-sm font-medium text-white hover:text-brand-400"
                  >
                    {lead.businessName}
                  </Link>
                  {lead.source === 'affiliate_application' && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand-500/15 text-brand-300 align-middle">
                      Affiliate
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-white/60">
                  <div>{lead.contactName}</div>
                  <div className="text-xs text-white/40">{lead.contactEmail}</div>
                </td>
                <td className="px-4 py-3">
                  {stage && (
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${stage.color}`}
                    >
                      {stage.label}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {priority && (
                    <Badge variant={priority.badge}>{priority.label}</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-sm font-bold text-emerald-400">
                  {lead.estimatedValue != null
                    ? formatPrice(lead.estimatedValue)
                    : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-white/60">
                  {admin ? admin.name || admin.email : 'Unassigned'}
                </td>
                <td className="px-4 py-3 text-sm text-white/50">
                  {lead.nextAction ? (
                    <div>
                      <div>{lead.nextAction}</div>
                      {lead.nextActionDue && (
                        <div className="text-xs text-white/40">
                          {new Date(lead.nextActionDue).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3 w-44">
                  <LeadStageSelect leadId={lead.id} currentStage={lead.stage} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
