import Link from 'next/link'
import { Download, ExternalLink, FileText, Library as LibraryIcon, Lock, PlayCircle, Search, BookOpen, Link2 } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { LIBRARY_CATEGORIES, categoryLabel, kindLabel, searchLibrary } from '@/lib/vip/library'
import { formatBytes } from '@/lib/vip/files'
import { EmptyState, PageHeader, TierBadge } from '@/components/vip/ui'
import { Pill } from '@/components/vip/academy-ui'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Library' }

const KIND_ICON = { GUIDE: BookOpen, PDF: FileText, RECORDING: PlayCircle, LINK: Link2 } as const

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string; c?: string }> }) {
  const viewer = await requireVipPage('member')
  const { q, c } = await searchParams
  const query = typeof q === 'string' ? q.slice(0, 100) : ''
  const category = typeof c === 'string' ? c : ''
  const { items, counts } = await searchLibrary({ accessTier: viewer.accessTier, q: query, category })
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const chips = [{ key: '', label: 'All', n: total }, ...LIBRARY_CATEGORIES.filter((x) => counts[x.key]).map((x) => ({ key: x.key, label: x.label, n: counts[x.key] }))]
  const href = (k: string) => {
    const p = new URLSearchParams()
    if (query) p.set('q', query)
    if (k) p.set('c', k)
    const s = p.toString()
    return s ? `/library?${s}` : '/library'
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Library" intro="Guides, PDFs, research-literacy explainers and every recorded session — searchable, in one place." />

      <form action="/library" method="get" role="search" className="mb-4">
        {category && <input type="hidden" name="c" value={category} />}
        <label className="relative block">
          <span className="sr-only">Search the Library</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" aria-hidden="true" />
          <input
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search guides, PDFs and recordings"
            className="vip-focus h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] pl-10 pr-3 text-[15px] text-white placeholder:text-white/50"
          />
        </label>
      </form>

      {total > 0 && (
        <nav className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden" aria-label="Library categories">
          {chips.map((ch) => {
            const on = ch.key === category
            return (
              <Link
                key={ch.key || 'all'}
                href={href(ch.key)}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'vip-focus inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium',
                  on ? 'border-brand-400/50 bg-brand-500/20 text-white' : 'border-white/10 text-white/70 hover:bg-white/[0.05]',
                )}
              >
                {ch.label} <span className="text-xs text-white/60">{ch.n}</span>
              </Link>
            )
          })}
        </nav>
      )}

      {items.length === 0 ? (
        query || category ? (
          <EmptyState title="Nothing matches that yet.">
            Try a different word or category.{' '}
            <Link href="/library" className="font-semibold text-brand-300 hover:text-brand-200">
              Clear the search
            </Link>
          </EmptyState>
        ) : (
          <EmptyState title="The Library fills up as the team publishes.">Guides, PDFs and every recorded live session land here.</EmptyState>
        )
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" data-testid="library-items">
          {items.map((it) => {
            const Icon = KIND_ICON[it.kind as keyof typeof KIND_ICON] ?? LibraryIcon
            const body = (
              <>
                <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl', it.allowed ? 'bg-brand-500/15 ring-1 ring-inset ring-brand-400/25' : 'bg-white/[0.05]')} aria-hidden="true">
                  <Icon className={cn('h-5 w-5', it.allowed ? 'text-brand-300' : 'text-white/50')} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Pill>{kindLabel(it.kind)}</Pill>
                    <span className="text-xs text-white/60">{categoryLabel(it.category)}</span>
                  </span>
                  <span className="mt-1 block font-semibold leading-snug">{it.title}</span>
                  {it.summary && <span className="mt-1 line-clamp-2 block text-sm text-white/65">{it.summary}</span>}
                  <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/60">
                    {it.allowed ? (
                      it.fileName ? (
                        <span className="inline-flex items-center gap-1">
                          <Download className="h-3.5 w-3.5" aria-hidden="true" /> {it.fileName}
                          {it.sizeBytes ? ` · ${formatBytes(it.sizeBytes)}` : ''}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Opens in a new tab
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Opens at <TierBadge tier={it.minTier} />
                      </span>
                    )}
                  </span>
                </span>
              </>
            )
            return (
              <li key={it.id}>
                {it.allowed && it.href ? (
                  <a
                    href={it.href}
                    target="_blank"
                    rel={it.external ? 'noopener noreferrer' : undefined}
                    className="vip-focus vip-surface flex h-full gap-4 p-4 hover:bg-white/[0.04] sm:p-5"
                  >
                    {body}
                  </a>
                ) : (
                  <div className="vip-surface flex h-full gap-4 p-4 opacity-90 sm:p-5">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
