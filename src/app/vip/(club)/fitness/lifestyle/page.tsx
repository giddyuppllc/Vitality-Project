import Link from 'next/link'
import { Lock } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { ARTICLE_CATEGORIES, categoryFromSlug, categoryLabel, listArticles } from '@/lib/vip/fitness/articles'
import { FIT_COPY } from '@/lib/vip/fitness/copy'
import { cn } from '@/lib/utils'
import { EmptyState, PageHeader, TierBadge } from '@/components/vip/ui'
import { FitnessTabs } from '@/components/vip/fitness/tabs'
import { WellnessNote } from '@/components/vip/fitness/bits'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Lifestyle' }

export default async function LifestylePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireVipPage('member')
  const sp = await searchParams
  const category = categoryFromSlug(typeof sp.category === 'string' ? sp.category : undefined)
  const articles = await listArticles(viewer.accessTier, category)

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={FIT_COPY.lifestyle.title} intro={FIT_COPY.lifestyle.intro} />
      <FitnessTabs />
      <nav aria-label="Categories" className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="flex w-max gap-1.5">
          {[{ slug: '', label: 'All', value: undefined }, ...ARTICLE_CATEGORIES].map((c) => {
            const on = c.value === category
            return (
              <li key={c.slug || 'all'}>
                <Link
                  href={c.slug ? `/fitness/lifestyle?category=${c.slug}` : '/fitness/lifestyle'}
                  aria-current={on ? 'true' : undefined}
                  className={cn('vip-focus inline-flex h-9 items-center rounded-full border px-3 text-sm', on ? 'border-brand-400/40 bg-brand-500/20 text-white' : 'border-white/10 text-white/65 hover:text-white')}
                >
                  {c.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      {articles.length === 0 ? (
        <EmptyState title={FIT_COPY.lifestyle.empty.title}>{FIT_COPY.lifestyle.empty.body}</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {articles.map((a) => (
            <li key={a.id}>
              <Link href={`/fitness/lifestyle/${a.slug}`} className="vip-surface vip-focus block h-full overflow-hidden hover:bg-white/[0.04]">
                {a.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- admin-entered cover URL
                  <img src={a.coverImage} alt="" className="h-40 w-full object-cover" />
                ) : (
                  <div className="h-20 w-full bg-gradient-to-br from-brand-900/70 via-dark-700/40 to-transparent" aria-hidden="true" />
                )}
                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-200">
                    {categoryLabel(a.category)} <span className="font-normal normal-case tracking-normal text-white/55">· {a.minutes} min read</span>
                  </p>
                  <div className="mt-1.5 flex items-start justify-between gap-3">
                    <h2 className="font-semibold leading-snug">{a.title}</h2>
                    {!a.allowed && <Lock className="mt-0.5 h-4 w-4 shrink-0 text-white/45" aria-label="Locked" />}
                  </div>
                  {a.summary && <p className="mt-1.5 line-clamp-3 text-sm text-white/60">{a.summary}</p>}
                  {a.minTier !== 'CLUB' && (
                    <div className="mt-3">
                      <TierBadge tier={a.minTier} />
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <WellnessNote />
    </div>
  )
}
