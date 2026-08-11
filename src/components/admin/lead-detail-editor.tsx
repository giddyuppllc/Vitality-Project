'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LEAD_PRIORITIES, LEAD_SOURCES, LEAD_STAGES } from './lead-constants'
import { parseMoneyToCents } from '@/lib/money'

interface AdminInfo {
  id: string
  email: string
  name: string | null
}

interface LeadDetail {
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
  notes: string | null
  nextAction: string | null
  nextActionDue: string | null
  closedReason: string | null
  organizationId: string | null
}

export function LeadDetailEditor({
  lead,
  admins,
}: {
  lead: LeadDetail
  admins: AdminInfo[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [businessName, setBusinessName] = useState(lead.businessName)
  const [contactName, setContactName] = useState(lead.contactName)
  const [contactEmail, setContactEmail] = useState(lead.contactEmail)
  const [contactPhone, setContactPhone] = useState(lead.contactPhone ?? '')
  const [source, setSource] = useState(lead.source ?? 'other')
  const [stage, setStage] = useState(lead.stage)
  const [priority, setPriority] = useState(lead.priority)
  const [estimatedValue, setEstimatedValue] = useState(
    lead.estimatedValue != null ? (lead.estimatedValue / 100).toFixed(2) : '',
  )
  const [probability, setProbability] = useState(
    lead.probability != null ? String(lead.probability) : '',
  )
  const [assignedTo, setAssignedTo] = useState(lead.assignedTo ?? '')
  const [notes, setNotes] = useState(lead.notes ?? '')
  const [nextAction, setNextAction] = useState(lead.nextAction ?? '')
  const [nextActionDue, setNextActionDue] = useState(
    lead.nextActionDue
      ? new Date(lead.nextActionDue).toISOString().slice(0, 16)
      : '',
  )
  const [closedReason, setClosedReason] = useState(lead.closedReason ?? '')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          contactName,
          contactEmail,
          contactPhone: contactPhone || null,
          source,
          stage,
          priority,
          estimatedValue: estimatedValue
            ? (parseMoneyToCents(estimatedValue) ?? 0)
            : null,
          probability: probability ? parseInt(probability, 10) : null,
          assignedTo: assignedTo || null,
          notes: notes || null,
          nextAction: nextAction || null,
          nextActionDue: nextActionDue || null,
          closedReason: closedReason || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErr(data?.error || 'Failed to save')
        return
      }
      router.refresh()
    } catch {
      setErr('Failed to save')
    } finally {
      setLoading(false)
    }
  }

  async function deleteLead() {
    if (
      !confirm('Delete this lead? This cannot be undone.')
    )
      return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        alert('Failed to delete')
        return
      }
      router.push('/admin/leads')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={save} className="glass rounded-2xl p-6 space-y-4">
      <h2 className="font-semibold text-lg mb-2">Lead Details</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Business name"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
        />
        <Input
          label="Contact name"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
        />
        <Input
          label="Contact email"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
        />
        <Input
          label="Contact phone"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-white/70">Stage</label>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {LEAD_STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-white/70">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {LEAD_PRIORITIES.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-white/70">Source</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {LEAD_SOURCES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-white/70">
            Assigned to
          </label>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Unassigned</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name || a.email}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Estimated value (USD / month)"
          type="number"
          min="0"
          step="0.01"
          value={estimatedValue}
          onChange={(e) => setEstimatedValue(e.target.value)}
        />
        <Input
          label="Probability (%)"
          type="number"
          min="0"
          max="100"
          value={probability}
          onChange={(e) => setProbability(e.target.value)}
        />

        <Input
          label="Next action"
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
        />
        <Input
          label="Next action due"
          type="datetime-local"
          value={nextActionDue}
          onChange={(e) => setNextActionDue(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-white/70">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {(stage === 'CLOSED_WON' || stage === 'CLOSED_LOST') && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-white/70">
            Closed reason
          </label>
          <textarea
            value={closedReason}
            onChange={(e) => setClosedReason(e.target.value)}
            rows={3}
            placeholder={
              stage === 'CLOSED_WON'
                ? 'Why did this close? Key drivers?'
                : 'Why did we lose? Lessons learned?'
            }
            className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      )}

      {err && <p className="text-sm text-red-400">{err}</p>}

      <div className="flex items-center justify-between pt-2">
        <Button type="submit" loading={loading}>
          Save Changes
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          loading={loading}
          onClick={deleteLead}
        >
          Delete Lead
        </Button>
      </div>
    </form>
  )
}
