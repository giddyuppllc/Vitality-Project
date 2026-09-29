'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { Avatar } from './ui'

export function Composer({
  viewerName,
  viewerAvatar,
  spaces,
  defaultSpaceId,
  isAdmin,
}: {
  viewerName: string
  viewerAvatar: string | null
  spaces: { id: string; name: string; adminOnly: boolean }[]
  defaultSpaceId?: string | null
  isAdmin: boolean
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [body, setBody] = useState('')
  const [spaceId, setSpaceId] = useState(defaultSpaceId ?? '')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [announce, setAnnounce] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const postable = spaces.filter((s) => isAdmin || !s.adminOnly)

  async function upload(file: File) {
    setUploading(true)
    setError(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/vip/uploads', { method: 'POST', body: fd })
    const data = await res.json().catch(() => ({}))
    setUploading(false)
    if (!res.ok) setError(data.error || 'Upload failed.')
    else setImageUrl(data.url)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch('/api/vip/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, spaceId: spaceId || null, imageUrl, isAnnouncement: announce }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(data.error || 'Could not post.')
      return
    }
    setBody('')
    setImageUrl(null)
    setAnnounce(false)
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="vip-surface p-4 sm:p-5" aria-label="New post">
      <div className="flex gap-3">
        <Avatar name={viewerName} src={viewerAvatar} size={40} />
        <label className="min-w-0 flex-1">
          <span className="sr-only">Write a post</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={body.length > 80 ? 5 : 2}
            maxLength={5000}
            placeholder="Share with the community"
            className="vip-focus w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] p-3 text-[15px] text-white placeholder:text-white/40"
          />
        </label>
      </div>

      {imageUrl && (
        <div className="relative ml-[52px] mt-3 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element -- members-only media route */}
          <img src={imageUrl} alt="Attached image preview" className="max-h-48 rounded-xl border border-white/10" />
          <button
            type="button"
            onClick={() => setImageUrl(null)}
            aria-label="Remove image"
            className="vip-focus absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/70"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {error && <p role="alert" className="ml-[52px] mt-2 text-sm text-red-300">{error}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2 pl-[52px]">
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
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || !!imageUrl}
          className="vip-focus inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-white/60 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />}
          Photo
        </button>
        {postable.length > 0 && (
          <label className="text-sm text-white/60">
            <span className="sr-only">Space</span>
            <select
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
              className="vip-focus h-8 rounded-lg border border-white/10 bg-[#161a33] px-2 text-sm text-white/80"
            >
              <option value="">General</option>
              {postable.map((s) => (
                <option key={s.id} value={s.id}>
                  # {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {isAdmin && (
          <label className="inline-flex items-center gap-1.5 text-sm text-white/60">
            <input type="checkbox" checked={announce} onChange={(e) => setAnnounce(e.target.checked)} className="accent-brand-500" />
            Announcement
          </label>
        )}
        <button
          type="submit"
          disabled={busy || uploading || !body.trim()}
          className="vip-focus ml-auto inline-flex h-9 items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-40"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Post
        </button>
      </div>
    </form>
  )
}
