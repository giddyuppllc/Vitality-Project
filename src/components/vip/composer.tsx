'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Loader2, Video, X } from 'lucide-react'
import { Avatar } from './ui'
import { MentionTextarea } from './mention-textarea'
import { uploadVipImage } from './upload'

export const MAX_POST_IMAGES = 6

/** Photo thumbnails with remove buttons (composer + post editor). */
export function ImageTray({ images, onRemove }: { images: string[]; onRemove: (url: string) => void }) {
  if (!images.length) return null
  return (
    <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Attached photos">
      {images.map((url, i) => (
        <li key={url} className="relative aspect-square">
          {/* eslint-disable-next-line @next/next/no-img-element -- members-only media route */}
          <img src={url} alt={`Attached photo ${i + 1}`} className="h-full w-full rounded-xl border border-white/10 object-cover" />
          <button
            type="button"
            onClick={() => onRemove(url)}
            aria-label={`Remove photo ${i + 1}`}
            className="vip-focus absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/75"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  )
}

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
  const [images, setImages] = useState<string[]>([])
  const [showVideo, setShowVideo] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [announce, setAnnounce] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [earned, setEarned] = useState<string | null>(null)
  const postable = spaces.filter((s) => isAdmin || !s.adminOnly)

  async function addFiles(files: File[]) {
    setError(null)
    const room = MAX_POST_IMAGES - images.length
    if (files.length > room) setError(`Add up to ${MAX_POST_IMAGES} photos.`)
    const take = files.slice(0, Math.max(0, room))
    setUploading((n) => n + take.length)
    await Promise.all(
      take.map(async (f) => {
        const r = await uploadVipImage(f)
        setUploading((n) => n - 1)
        if (r.ok) setImages((cur) => (cur.length < MAX_POST_IMAGES && !cur.includes(r.url) ? [...cur, r.url] : cur))
        else setError(r.error)
      }),
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setEarned(null)
    const res = await fetch('/api/vip/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body,
        spaceId: spaceId || null,
        images,
        videoUrl: showVideo && videoUrl.trim() ? videoUrl.trim() : null,
        isAnnouncement: announce,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(data.error || 'Could not post.')
      return
    }
    const pts = (data.points?.firstPost ?? 0) + (data.points?.postDay ?? 0)
    if (pts > 0) setEarned(`Posted · +${pts} points`)
    setBody('')
    setImages([])
    setVideoUrl('')
    setShowVideo(false)
    setAnnounce(false)
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="vip-surface p-4 sm:p-5" aria-label="New post">
      <div className="flex gap-3">
        <Avatar name={viewerName} src={viewerAvatar} size={40} />
        <label className="min-w-0 flex-1">
          <span className="sr-only">Write a post</span>
          <MentionTextarea
            value={body}
            onValueChange={setBody}
            rows={body.length > 80 ? 5 : 2}
            maxLength={5000}
            placeholder="Share a win, a check-in or a question…"
            className="vip-focus w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] p-3 text-[15px] text-white placeholder:text-white/40"
          />
        </label>
      </div>

      <div className="sm:pl-[52px]">
        <ImageTray images={images} onRemove={(u) => setImages((cur) => cur.filter((x) => x !== u))} />
        {showVideo && (
          <label className="mt-3 block text-sm text-white/70">
            YouTube or Vimeo link
            <input
              type="url"
              inputMode="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              className="vip-focus mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white placeholder:text-white/40"
            />
          </label>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
        {earned && <p role="status" className="mt-2 text-sm text-emerald-300">{earned}</p>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 sm:pl-[52px]">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            if (files.length) addFiles(files)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading > 0 || images.length >= MAX_POST_IMAGES}
          className="vip-focus inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-white/70 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
        >
          {uploading > 0 ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />}
          Photos{images.length ? ` ${images.length}/${MAX_POST_IMAGES}` : ''}
        </button>
        <button
          type="button"
          onClick={() => setShowVideo((v) => !v)}
          aria-pressed={showVideo}
          className="vip-focus inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-white/70 hover:bg-white/[0.06] hover:text-white"
        >
          <Video className="h-4 w-4" aria-hidden="true" />
          Video
        </button>
        {postable.length > 0 && (
          <label className="text-sm text-white/60">
            <span className="sr-only">Space</span>
            <select
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
              className="vip-focus h-8 max-w-[11rem] rounded-lg border border-white/10 bg-[#161a33] px-2 text-sm text-white/80"
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
          disabled={busy || uploading > 0 || !body.trim()}
          className="vip-focus ml-auto inline-flex h-9 items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-40"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Post
        </button>
      </div>
    </form>
  )
}
