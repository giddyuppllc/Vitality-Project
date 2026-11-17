'use client'

import { useId, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { adminInput } from './admin-vip-ui'

/**
 * Image picker for clubhouse admin content: paste an https:// link or upload
 * a file (POST /api/admin/vip/images → the clubhouse's members-only media
 * store). Used for course, program, challenge and article covers, exercise
 * images, reward images and partner logos.
 */
export function ImageField({
  value,
  onChange,
  labelText,
  hint,
}: {
  value: string
  onChange: (v: string) => void
  labelText: string
  hint?: string
}) {
  const id = useId()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  return (
    <div className="block text-sm text-white/70">
      <label htmlFor={id}>{labelText}</label>
      <div className="mt-1 flex gap-2">
        <input id={id} className={adminInput} value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://… or upload" maxLength={500} />
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-white/5 px-3 text-xs text-white/70 hover:bg-white/10 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-400">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Upload className="h-3.5 w-3.5" aria-hidden="true" />}
          Upload
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label={`Upload ${labelText.toLowerCase()}`}
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              setBusy(true)
              setErr(null)
              const fd = new FormData()
              fd.append('file', f)
              const res = await fetch('/api/admin/vip/images', { method: 'POST', body: fd }).catch(() => null)
              const data = await res?.json().catch(() => ({}))
              setBusy(false)
              if (!res?.ok) return setErr(data?.error || 'Upload failed')
              onChange(data.url)
            }}
          />
        </label>
      </div>
      {value.startsWith('/api/vip/media/') ? (
        <p className="mt-1 text-xs text-white/50">Uploaded — shown to signed-in members on vitalityproject.vip.</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-white/50">{hint}</p>
      ) : null}
      {err && (
        <p role="alert" className="mt-1 text-xs text-red-300">
          {err}
        </p>
      )}
    </div>
  )
}
