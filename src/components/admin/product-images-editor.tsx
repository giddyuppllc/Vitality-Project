'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Loader2, Trash2, Star, ImagePlus } from 'lucide-react'

interface ProductImage {
  id: string
  url: string
  alt: string | null
  position: number
}

export function ProductImagesEditor({ productId }: { productId: string }) {
  const [images, setImages] = useState<ProductImage[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () =>
    fetch(`/api/admin/products/${productId}/images`)
      .then((r) => r.json())
      .then((d) => setImages(Array.isArray(d) ? d : []))

  useEffect(() => {
    load().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError('')
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        // 1) store the file, get back its public /uploads URL
        const fd = new FormData()
        fd.append('file', file)
        const up = await fetch('/api/admin/upload', { method: 'POST', body: fd })
        if (!up.ok) {
          const d = await up.json().catch(() => ({}))
          throw new Error(d.error || 'Upload failed')
        }
        const { url } = await up.json()
        // 2) attach it to this product
        const add = await fetch(`/api/admin/products/${productId}/images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, alt: file.name.replace(/\.[^.]+$/, '') }),
        })
        if (!add.ok) throw new Error('Could not attach image')
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function makePrimary(imageId: string) {
    setBusyId(imageId)
    setError('')
    try {
      await fetch(`/api/admin/products/${productId}/images/${imageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ makePrimary: true }),
      })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function remove(imageId: string) {
    if (!confirm('Remove this image?')) return
    setBusyId(imageId)
    setError('')
    try {
      await fetch(`/api/admin/products/${productId}/images/${imageId}`, {
        method: 'DELETE',
      })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-white/40 text-sm py-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading images…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Hidden native picker — accept="image/*" lets phones offer
          "Take Photo" or "Photo Library", so Edward can shoot a product and
          attach it on the spot. */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />

      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {images.map((img, i) => {
            const isPrimary = i === 0
            const busy = busyId === img.id
            return (
              <div
                key={img.id}
                className={`group relative aspect-square rounded-xl overflow-hidden border ${
                  isPrimary ? 'border-brand-500' : 'border-white/10'
                } bg-dark-800`}
              >
                <Image
                  src={img.url}
                  alt={img.alt ?? ''}
                  fill
                  sizes="160px"
                  className="object-cover"
                />

                {isPrimary && (
                  <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-md bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    <Star className="w-3 h-3 fill-current" /> Card
                  </span>
                )}

                {/* Hover actions */}
                <div className="absolute inset-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!isPrimary ? (
                    <button
                      type="button"
                      onClick={() => makePrimary(img.id)}
                      disabled={busy}
                      title="Use as card image"
                      className="inline-flex items-center gap-1 rounded-md bg-white/15 hover:bg-white/25 px-1.5 py-1 text-[10px] font-medium text-white backdrop-blur"
                    >
                      <Star className="w-3 h-3" /> Card
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={() => remove(img.id)}
                    disabled={busy}
                    title="Remove image"
                    className="inline-flex items-center justify-center rounded-md bg-red-500/80 hover:bg-red-500 p-1 text-white"
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add button / dropzone */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 hover:border-brand-500/50 hover:bg-white/[0.02] py-6 text-white/50 hover:text-white/80 transition-colors disabled:opacity-60"
      >
        {uploading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Uploading…</span>
          </>
        ) : (
          <>
            <ImagePlus className="w-5 h-5" />
            <span className="text-sm font-medium">
              {images.length === 0 ? 'Add product photo' : 'Add another photo'}
            </span>
            <span className="text-xs text-white/30">
              Take a photo or choose from your library · JPG, PNG, WebP · max 10MB
            </span>
          </>
        )}
      </button>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {images.length === 0 && !uploading && (
        <p className="text-xs text-white/30">
          No photo yet — this product shows the default vial image on its card
          until you add one.
        </p>
      )}
    </div>
  )
}
