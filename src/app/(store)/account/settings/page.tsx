'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Settings,
  Check,
  AlertCircle,
  Mail,
  MessageSquareText,
  Phone,
} from 'lucide-react'

export default function SettingsPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [name, setName] = useState(session?.user?.name ?? '')
  const [email, setEmail] = useState(session?.user?.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [commPrefs, setCommPrefs] = useState({
    transactionalEmail: true,
    marketingEmail: true,
    sms: false,
    phoneContact: true,
  })
  const [commSaved, setCommSaved] = useState(false)

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/account/communication')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setCommPrefs({
            transactionalEmail: data.transactionalEmail ?? true,
            marketingEmail: data.marketingEmail ?? true,
            sms: data.sms ?? false,
            phoneContact: data.phoneContact ?? true,
          })
        }
      })
      .catch(() => {})
  }, [status])

  const updateCommPref = async (key: keyof typeof commPrefs, value: boolean) => {
    const next = { ...commPrefs, [key]: value }
    setCommPrefs(next)
    const res = await fetch('/api/account/communication', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    })
    if (res.ok) {
      setCommSaved(true)
      setTimeout(() => setCommSaved(false), 1500)
    }
  }

  if (status === 'loading') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <p className="text-white/40">Loading...</p>
      </div>
    )
  }

  if (!session) {
    router.push('/auth/login')
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    if (newPassword && newPassword.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/account/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || undefined,
          email: email || undefined,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setSuccess('Settings updated successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      // Update the session with new data
      await update({ name, email })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Settings className="w-5 h-5 text-brand-400" />
        <h1 className="text-2xl font-bold">Account Settings</h1>
      </div>

      {success && (
        <div className="glass rounded-2xl p-4 mb-6 border border-emerald-500/30 flex items-center gap-3">
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-400">{success}</p>
        </div>
      )}

      {error && (
        <div className="glass rounded-2xl p-4 mb-6 border border-red-500/30 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-4">Profile</h2>
          <div className="space-y-4">
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
        </div>

        {/* Password */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-4">Change Password</h2>
          <p className="text-sm text-white/40 mb-4">Leave blank to keep your current password.</p>
          <div className="space-y-4">
            <Input
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
            />
            <Input
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>
        </div>

        <Button type="submit" size="lg" loading={loading} className="w-full">
          Save Changes
        </Button>
      </form>

      {/* Communication Preferences */}
      <div className="glass rounded-2xl p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold">Communication Preferences</h2>
            <p className="text-sm text-white/40 mt-0.5">
              Control how we contact you.
            </p>
          </div>
          {commSaved && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
        </div>
        <div className="space-y-3">
          <PrefRow
            icon={<Mail className="w-4 h-4 text-emerald-400" />}
            label="Transactional email"
            desc="Order confirmations, shipping updates, password resets. Required for purchases."
            checked={commPrefs.transactionalEmail}
            onChange={() => {}}
            disabled
          />
          <PrefRow
            icon={<Mail className="w-4 h-4 text-brand-400" />}
            label="Marketing email"
            desc="Product news, research digests, promotions."
            checked={commPrefs.marketingEmail}
            onChange={(v) => updateCommPref('marketingEmail', v)}
          />
          <PrefRow
            icon={<MessageSquareText className="w-4 h-4 text-purple-400" />}
            label="SMS"
            desc="Text message updates. Placeholder — not yet wired."
            checked={commPrefs.sms}
            onChange={(v) => updateCommPref('sms', v)}
          />
          <PrefRow
            icon={<Phone className="w-4 h-4 text-amber-400" />}
            label="Phone contact OK"
            desc="Our team may call you for sales or support."
            checked={commPrefs.phoneContact}
            onChange={(v) => updateCommPref('phoneContact', v)}
          />
        </div>
      </div>
    </div>
  )
}

function PrefRow({
  icon,
  label,
  desc,
  checked,
  onChange,
  disabled,
}: {
  icon: React.ReactNode
  label: string
  desc: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-white/3 border border-white/5">
      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-white/40 mt-0.5">{desc}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer shrink-0">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-10 h-5 bg-white/10 peer-checked:bg-brand-500 rounded-full transition-colors peer-disabled:opacity-50 relative after:content-[''] after:absolute after:left-0.5 after:top-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-transform peer-checked:after:translate-x-5" />
      </label>
    </div>
  )
}
