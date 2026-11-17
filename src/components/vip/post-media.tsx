'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { videoEmbed } from '@/lib/vip/text'
import { cn } from '@/lib/utils'

/** A post's video link as a privacy-friendly embed (YouTube nocookie / Vimeo dnt), like lessons. */
export function PostVideo({ url }: { url: string }) {
  const v = videoEmbed(url)
  if (!v) return null
  if (v.kind === 'link') {
    return (
      <a href={v.href} target="_blank" rel="nofollow noopener noreferrer ugc" className="mt-3 inline-block text-sm font-semibold text-brand-300 hover:text-brand-200">
        Watch the video →
      </a>
    )
  }
  return (
    <div className="mt-3 aspect-video overflow-hidden rounded-xl border border-white/10 bg-black">
      <iframe
        src={v.src}
        title={v.provider === 'youtube' ? 'YouTube video shared by the member' : 'Vimeo video shared by the member'}
        className="h-full w-full"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
      />
    </div>
  )
}

/** Up to six photos: a tidy grid, each opening a full-size viewer. */
export function PostImages({ images }: { images: string[] }) {
  const [open, setOpen] = useState<number | null>(null)
  if (!images.length) return null
  const n = images.length
  const grid = n === 1 ? 'grid-cols-1' : n === 2 || n === 4 ? 'grid-cols-2' : 'grid-cols-3'
  return (
    <>
      <ul className={cn('mt-3 grid gap-1.5 overflow-hidden rounded-xl', grid)} aria-label={n > 1 ? `${n} photos` : 'Photo'}>
        {images.map((src, i) => (
          <li key={src} className={cn(n === 3 && i === 0 && 'col-span-3', n === 5 && i < 2 && 'col-span-1')}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              className="vip-focus block w-full overflow-hidden rounded-lg"
              aria-label={`Open photo ${i + 1} of ${n}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- members-only media route */}
              <img
                src={src}
                alt=""
                loading="lazy"
                className={cn(
                  'w-full border border-white/10 object-cover',
                  n === 1 ? 'max-h-[520px] rounded-xl' : n === 3 && i === 0 ? 'aspect-[16/9]' : 'aspect-square',
                )}
              />
            </button>
          </li>
        ))}
      </ul>
      {open !== null && <Lightbox images={images} start={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function Lightbox({ images, start, onClose }: { images: string[]; start: number; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [i, setI] = useState(start)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  const many = images.length > 1
  const go = (d: number) => setI((x) => (x + d + images.length) % images.length)
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onKeyDown={(e) => {
        if (!many) return
        if (e.key === 'ArrowRight') go(1)
        if (e.key === 'ArrowLeft') go(-1)
      }}
      aria-label={`Photo ${i + 1} of ${images.length}`}
      className="m-auto max-h-[94vh] w-[min(96vw,1100px)] bg-transparent p-0 text-white backdrop:bg-black/85"
    >
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element -- members-only media route */}
        <img src={images[i]} alt={`Photo ${i + 1} of ${images.length}`} className="mx-auto max-h-[88vh] w-auto rounded-xl object-contain" />
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Close"
          className="vip-focus absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full bg-black/70"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        {many && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="vip-focus absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/70">
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next photo" className="vip-focus absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/70">
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <p className="mt-2 text-center text-sm text-white/75">{i + 1} / {images.length}</p>
          </>
        )}
      </div>
    </dialog>
  )
}
