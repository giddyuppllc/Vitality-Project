import { notFound } from 'next/navigation'
import { requireVipPage } from '@/lib/vip/page-gate'
import { categoryLabel, getArticle } from '@/lib/vip/fitness/articles'
import { renderLessonMarkdown } from '@/lib/vip/text'
import { FitnessTabs } from '@/components/vip/fitness/tabs'
import { BackLink, LockedNotice, WellnessNote } from '@/components/vip/fitness/bits'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Lifestyle' }

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const viewer = await requireVipPage('member')
  const { slug } = await params
  const data = await getArticle(slug, viewer.accessTier)
  if (!data) notFound()
  const { article, allowed, minutes } = data

  return (
    <div className="mx-auto max-w-3xl">
      <FitnessTabs />
      <BackLink href="/fitness/lifestyle">Lifestyle</BackLink>
      <article className="vip-surface-strong overflow-hidden">
        {article.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element -- admin-entered cover URL
          <img src={article.coverImage} alt="" className="h-48 w-full object-cover sm:h-64" />
        )}
        <div className="p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-200">
            {categoryLabel(article.category)} <span className="font-normal normal-case tracking-normal text-white/55">· {minutes} min read</span>
          </p>
          <h1 className="mt-1 text-2xl font-bold sm:text-[28px]">{article.title}</h1>
          {article.summary && <p className="mt-2 text-[15px] leading-relaxed text-white/70">{article.summary}</p>}
          {allowed ? (
            <div className="vip-prose mt-5" dangerouslySetInnerHTML={{ __html: renderLessonMarkdown(article.body) }} />
          ) : (
            // The body is never sent to members below the tier.
            <div className="mt-6">
              <LockedNotice minTier={article.minTier} what="guide" />
            </div>
          )}
        </div>
      </article>
      <WellnessNote />
    </div>
  )
}
