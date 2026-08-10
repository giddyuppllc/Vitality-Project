'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2 } from 'lucide-react'

interface RelatedLink {
  href: string
  label: string
}

export interface PostFormValues {
  id?: string
  title: string
  slug: string
  excerpt: string
  content: string
  category: string
  readTime: string
  coverImage: string
  authorName: string
  relatedLinks: RelatedLink[]
  published: boolean
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function PostForm({ initial }: { initial?: Partial<PostFormValues> }) {
  const router = useRouter()
  const isEdit = !!initial?.id
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slugTouched, setSlugTouched] = useState(isEdit)

  const [v, setV] = useState<PostFormValues>({
    id: initial?.id,
    title: initial?.title ?? '',
    slug: initial?.slug ?? '',
    excerpt: initial?.excerpt ?? '',
    content: initial?.content ?? '',
    category: initial?.category ?? 'Research',
    readTime: initial?.readTime ?? '',
    coverImage: initial?.coverImage ?? '',
    authorName: initial?.authorName ?? '',
    relatedLinks: initial?.relatedLinks ?? [],
    published: initial?.published ?? false,
  })

  const set = <K extends keyof PostFormValues>(k: K, val: PostFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }))

  const onTitle = (title: string) => {
    setV((prev) => ({
      ...prev,
      title,
      slug: slugTouched ? prev.slug : slugify(title),
    }))
  }

  const addLink = () => set('relatedLinks', [...v.relatedLinks, { href: '', label: '' }])
  const setLink = (i: number, patch: Partial<RelatedLink>) =>
    set(
      'relatedLinks',
      v.relatedLinks.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    )
  const removeLink = (i: number) =>
    set('relatedLinks', v.relatedLinks.filter((_, idx) => idx !== i))

  const submit = async (publishedOverride?: boolean) => {
    setSaving(true)
    setError(null)
    const published = publishedOverride ?? v.published
    const payload = {
      title: v.title,
      slug: v.slug,
      excerpt: v.excerpt,
      content: v.content,
      category: v.category,
      readTime: v.readTime || null,
      coverImage: v.coverImage || null,
      authorName: v.authorName || null,
      relatedLinks: v.relatedLinks.filter((l) => l.href && l.label),
      published,
    }
    try {
      const res = await fetch(
        isEdit ? `/api/admin/blog/${v.id}` : '/api/admin/blog',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `Save failed (${res.status})`)
      }
      router.push('/admin/blog')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="space-y-6 max-w-3xl"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <Input label="Title" value={v.title} onChange={(e) => onTitle(e.target.value)} required />

      <Input
        label="Slug"
        value={v.slug}
        onChange={(e) => {
          setSlugTouched(true)
          set('slug', e.target.value)
        }}
        required
      />

      <div>
        <label className="text-sm font-medium text-white/70 mb-1.5 block">Excerpt</label>
        <textarea
          value={v.excerpt}
          onChange={(e) => set('excerpt', e.target.value)}
          rows={2}
          required
          className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input label="Category" value={v.category} onChange={(e) => set('category', e.target.value)} />
        <Input
          label="Read time (optional)"
          placeholder="auto"
          value={v.readTime}
          onChange={(e) => set('readTime', e.target.value)}
        />
        <Input label="Author (optional)" value={v.authorName} onChange={(e) => set('authorName', e.target.value)} />
      </div>

      <Input
        label="Cover image URL (optional)"
        value={v.coverImage}
        onChange={(e) => set('coverImage', e.target.value)}
      />

      <div>
        <label className="text-sm font-medium text-white/70 mb-1.5 block">Content (HTML)</label>
        <textarea
          value={v.content}
          onChange={(e) => set('content', e.target.value)}
          rows={18}
          required
          placeholder="<p>Write the article body as HTML…</p>"
          className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white text-sm font-mono placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-white/70">Related links</label>
          <Button type="button" size="sm" variant="secondary" onClick={addLink}>
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>
        <div className="space-y-2">
          {v.relatedLinks.map((l, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input placeholder="/path or URL" value={l.href} onChange={(e) => setLink(i, { href: e.target.value })} />
              <Input placeholder="Label" value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} />
              <button type="button" onClick={() => removeLink(i)} className="text-red-400 p-2">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" checked={v.published} onChange={(e) => set('published', e.target.checked)} />
        Published (visible on the public blog)
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" loading={saving}>
          {isEdit ? 'Save changes' : v.published ? 'Create & publish' : 'Save draft'}
        </Button>
        {!v.published && (
          <Button type="button" variant="secondary" loading={saving} onClick={() => void submit(true)}>
            {isEdit ? 'Save & publish' : 'Create & publish'}
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={() => router.push('/admin/blog')}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
