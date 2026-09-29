'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type OrgType = 'GYM' | 'CLINIC' | 'DOCTOR_OFFICE' | 'OTHER'

interface InviteResponse {
  organization?: { id: string; name: string }
  owner?: { email: string; name: string | null; needsActivation: boolean }
  activationUrl?: string | null
  emailSent?: boolean
  error?: string
}

export function InviteGymButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<InviteResponse | null>(null)
  const [form, setForm] = useState<{ ownerName: string; ownerEmail: string; orgName: string; orgType: OrgType }>({
    ownerName: '',
    ownerEmail: '',
    orgName: '',
    orgType: 'GYM',
  })

  const close = () => {
    setOpen(false)
    setError('')
    setSuccess(null)
    setForm({ ownerName: '', ownerEmail: '', orgName: '', orgType: 'GYM' })
    if (success) router.refresh()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = (await res.json()) as InviteResponse
      if (!res.ok) {
        setError(data.error || 'Invite failed')
        return
      }
      setSuccess(data)
    } catch (err: any) {
      setError(err?.message || 'Invite failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-black font-semibold rounded-lg text-sm transition-colors"
      >
        <UserPlus className="w-4 h-4" />
        Invite Gym Owner
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => !submitting && close()}>
          <div className="w-full max-w-md bg-dark-800 border border-white/10 rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Invite Gym Owner</h3>
                <p className="text-xs text-white/40 mt-1">Creates the organization, owner account, and emails them an activation link.</p>
              </div>
              <button type="button" onClick={close} className="text-white/40 hover:text-white" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            {success ? (
              <div className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 text-sm">
                  <p className="text-emerald-300 font-medium">
                    {success.emailSent ? 'Invite sent.' : 'Account created — email failed.'}
                  </p>
                  <p className="text-emerald-200/80 text-xs mt-1">
                    {success.organization?.name} owned by {success.owner?.email}
                  </p>
                </div>

                {success.activationUrl && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 text-xs">
                    <p className="text-amber-300 font-medium mb-1">Share this link manually:</p>
                    <code className="text-amber-100 break-all block bg-black/40 p-2 rounded">{success.activationUrl}</code>
                  </div>
                )}

                <Button onClick={close} className="w-full">Done</Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-300">{error}</div>
                )}

                <Input
                  label="Owner Name"
                  required
                  value={form.ownerName}
                  onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                  placeholder="Jane Smith"
                />
                <Input
                  label="Owner Email"
                  type="email"
                  required
                  value={form.ownerEmail}
                  onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
                  placeholder="jane@gymsanmeritus.com"
                />
                <Input
                  label="Organization Name"
                  required
                  value={form.orgName}
                  onChange={(e) => setForm({ ...form, orgName: e.target.value })}
                  placeholder="Gym San Meritus"
                />

                <label className="block">
                  <span className="block text-sm text-white/60 mb-1">Type</span>
                  <select
                    value={form.orgType}
                    onChange={(e) => setForm({ ...form, orgType: e.target.value as OrgType })}
                    className="w-full px-3 py-2 bg-dark-900 border border-white/10 rounded-lg text-white text-sm focus:border-brand-400 focus:outline-none"
                  >
                    <option value="GYM">Gym</option>
                    <option value="CLINIC">Clinic</option>
                    <option value="DOCTOR_OFFICE">Doctor's Office</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>

                <p className="text-xs text-white/40">
                  Organization is created <strong>active immediately</strong> (admin-invited bypasses the public-application review).
                  Owner gets a 7-day activation link to set their password.
                </p>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={close} className="px-4 py-2 text-sm text-white/60 hover:text-white">Cancel</button>
                  <Button type="submit" loading={submitting}>Send Invite</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
