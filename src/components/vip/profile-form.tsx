'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Avatar } from './ui'

export function ProfileForm({
  initial,
  fallbackName,
  disabled,
}: {
  initial: { displayName: string | null; bio: string | null; avatarUrl: string | null }
  fallbackName: string
  disabled?: boolean
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [displayName, setDisplayName] = useState(initial.displayName ?? '')
  const [bio, setBio] = useState(initial.bio ?? '')
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function upload(file: File) {
    setBusy(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/vip/uploads', { method: 'POST', body: fd })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.ok) setAvatarUrl(data.url)
    else setMsg({ ok: false, text: data.error || 'Upload failed.' })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const res = await fetch('/api/vip/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, bio, avatarUrl }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    setMsg(res.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: data.error || 'Could not save.' })
    if (res.ok) router.refresh()
  }

  const field = 'vip-focus mt-1.5 w-full rounded-xl border border-white/12 bg-white/[0.05] px-3 text-[15px] text-white placeholder:text-white/35'

  return (
    <form onSubmit={save} className="vip-surface-strong space-y-5 p-5 sm:p-6">
      <fieldset disabled={disabled || busy} className="space-y-5 disabled:opacity-60">
        <div className="flex items-center gap-4">
          <Avatar name={displayName || fallbackName} src={avatarUrl} size={72} />
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) upload(f)
                e.target.value = ''
              }}
            />
            <button type="button" onClick={() => fileRef.current?.click()} className="vip-focus rounded-xl border border-white/15 px-3.5 py-2 text-sm font-medium hover:bg-white/[0.06]">
              Change photo
            </button>
            {avatarUrl && (
              <button type="button" onClick={() => setAvatarUrl(null)} className="vip-focus rounded-xl px-3.5 py-2 text-sm text-white/60 hover:bg-white/[0.06]">
                Remove
              </button>
            )}
          </div>
        </div>
        <label className="block text-sm font-medium text-white/80">
          Display name
          <input className={`${field} h-11`} value={displayName} maxLength={60} placeholder={fallbackName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label className="block text-sm font-medium text-white/80">
          Bio
          <textarea className={`${field} py-2.5`} value={bio} maxLength={600} rows={5} onChange={(e) => setBio(e.target.value)} />
        </label>
      </fieldset>
      {msg && (
        <p role="status" className={msg.ok ? 'text-sm text-emerald-300' : 'text-sm text-red-300'}>
          {msg.text}
        </p>
      )}
      <button
        type="submit"
        disabled={disabled || busy}
        className="vip-focus inline-flex h-10 items-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Save profile
      </button>
    </form>
  )
}
