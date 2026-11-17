'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { Avatar } from './ui'
import { uploadVipImage } from './upload'

export interface ProfileFormValues {
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  coverUrl: string | null
  location: string | null
  interests: string[]
  profileVisibility: 'MEMBERS' | 'FOLLOWERS'
  dmPolicy: 'EVERYONE' | 'FOLLOWING' | 'NOBODY'
}

const MAX_INTERESTS = 10

export function ProfileForm({
  initial,
  fallbackName,
  disabled,
}: {
  initial: ProfileFormValues
  fallbackName: string
  disabled?: boolean
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)
  const [displayName, setDisplayName] = useState(initial.displayName ?? '')
  const [bio, setBio] = useState(initial.bio ?? '')
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl)
  const [coverUrl, setCoverUrl] = useState(initial.coverUrl)
  const [location, setLocation] = useState(initial.location ?? '')
  const [interests, setInterests] = useState<string[]>(initial.interests)
  const [interestDraft, setInterestDraft] = useState('')
  const [visibility, setVisibility] = useState(initial.profileVisibility)
  const [dmPolicy, setDmPolicy] = useState(initial.dmPolicy)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function upload(file: File, set: (url: string) => void) {
    setBusy(true)
    const r = await uploadVipImage(file)
    setBusy(false)
    if (r.ok) set(r.url)
    else setMsg({ ok: false, text: r.error })
  }

  function addInterest() {
    const t = interestDraft.trim().replace(/^#+/, '').toLowerCase().replace(/\s+/g, '_')
    if (!t) return
    if (!/^[a-z][a-z0-9_]{1,39}$/.test(t)) {
      setMsg({ ok: false, text: 'Interests use letters, numbers and _ (2–40 characters, starting with a letter).' })
      return
    }
    if (interests.length >= MAX_INTERESTS) {
      setMsg({ ok: false, text: `Add up to ${MAX_INTERESTS} interests.` })
      return
    }
    setMsg(null)
    if (!interests.includes(t)) setInterests([...interests, t])
    setInterestDraft('')
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const res = await fetch('/api/vip/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName,
        bio,
        avatarUrl,
        coverUrl,
        location,
        interests,
        profileVisibility: visibility,
        dmPolicy,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    setMsg(res.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: data.error || 'Could not save.' })
    if (res.ok) router.refresh()
  }

  const field = 'vip-focus mt-1.5 w-full rounded-xl border border-white/12 bg-white/[0.05] px-3 text-[15px] text-white placeholder:text-white/35'
  const fileInput = (ref: React.RefObject<HTMLInputElement | null>, set: (url: string) => void) => (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0]
        if (f) upload(f, set)
        e.target.value = ''
      }}
    />
  )

  return (
    <form onSubmit={save} className="vip-surface-strong space-y-5 overflow-hidden p-0">
      <fieldset disabled={disabled || busy} className="space-y-5 disabled:opacity-60">
        <div className="relative h-32 bg-gradient-to-br from-brand-800/70 via-[#0f1729] to-[#16213a] sm:h-40">
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- members-only media route
            <img src={coverUrl} alt="Your cover photo" className="h-full w-full object-cover" />
          )}
          {fileInput(coverRef, setCoverUrl)}
          <div className="absolute bottom-2 right-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => coverRef.current?.click()}
              className="vip-focus inline-flex items-center gap-1.5 rounded-xl bg-black/65 px-3 py-1.5 text-sm font-medium text-white hover:bg-black/80"
            >
              <ImagePlus className="h-4 w-4" aria-hidden="true" /> {coverUrl ? 'Change cover' : 'Add cover'}
            </button>
            {coverUrl && (
              <button
                type="button"
                onClick={() => setCoverUrl(null)}
                aria-label="Remove cover photo"
                className="vip-focus grid h-8 w-8 place-items-center rounded-xl bg-black/65 text-white hover:bg-black/80"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-5 px-5 sm:px-6">
          <div className="flex items-center gap-4">
            <Avatar name={displayName || fallbackName} src={avatarUrl} size={72} />
            <div className="flex flex-wrap gap-2">
              {fileInput(fileRef, setAvatarUrl)}
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
          <label className="block text-sm font-medium text-white/80">
            Location <span className="font-normal text-white/60">(optional)</span>
            <input
              className={`${field} h-11`}
              value={location}
              maxLength={80}
              placeholder="City, state or country"
              autoComplete="address-level2"
              onChange={(e) => setLocation(e.target.value)}
            />
          </label>

          <div>
            <label htmlFor="interest-input" className="block text-sm font-medium text-white/80">
              Interests <span className="font-normal text-white/60">({interests.length}/{MAX_INTERESTS})</span>
            </label>
            {interests.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Your interests">
                {interests.map((t) => (
                  <li key={t} className="inline-flex items-center gap-1 rounded-full border border-brand-400/30 bg-brand-500/10 py-1 pl-2.5 pr-1 text-xs font-medium text-brand-100">
                    {t}
                    <button
                      type="button"
                      onClick={() => setInterests(interests.filter((x) => x !== t))}
                      aria-label={`Remove ${t}`}
                      className="vip-focus grid h-5 w-5 place-items-center rounded-full hover:bg-white/10"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex gap-2">
              <input
                id="interest-input"
                className={`${field} mt-0 h-10 flex-1`}
                value={interestDraft}
                maxLength={41}
                placeholder="e.g. strength, sleep, trail_running"
                onChange={(e) => setInterestDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault()
                    addInterest()
                  }
                }}
              />
              <button type="button" onClick={addInterest} className="vip-focus h-10 rounded-xl border border-white/15 px-3.5 text-sm font-medium hover:bg-white/[0.06]">
                Add
              </button>
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-white/80">Who can see your profile</legend>
            {(
              [
                ['MEMBERS', 'All members', 'Your bio, posts, activity and follows are open to every member.'],
                ['FOLLOWERS', 'Followers only', 'Other members see your name and photo, and can follow you to see the rest.'],
              ] as const
            ).map(([v, label, hint]) => (
              <label key={v} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 p-3 text-sm has-[:checked]:border-brand-400/50 has-[:checked]:bg-brand-500/10">
                <input type="radio" name="visibility" value={v} checked={visibility === v} onChange={() => setVisibility(v)} className="mt-0.5 accent-brand-500" />
                <span>
                  <span className="block font-medium text-white">{label}</span>
                  <span className="block text-white/65">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-white/80">Who can message you</legend>
            {(
              [
                ['EVERYONE', 'Everyone', 'Any member can start a conversation with you.'],
                ['FOLLOWING', 'People I follow', 'Only members you follow can message you.'],
                ['NOBODY', 'Nobody', 'No one can start a new conversation or send you messages.'],
              ] as const
            ).map(([v, label, hint]) => (
              <label key={v} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 p-3 text-sm has-[:checked]:border-brand-400/50 has-[:checked]:bg-brand-500/10">
                <input type="radio" name="dmPolicy" value={v} checked={dmPolicy === v} onChange={() => setDmPolicy(v)} className="mt-0.5 accent-brand-500" />
                <span>
                  <span className="block font-medium text-white">{label}</span>
                  <span className="block text-white/65">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </div>
      </fieldset>
      <div className="space-y-3 px-5 pb-5 sm:px-6 sm:pb-6">
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
      </div>
    </form>
  )
}
