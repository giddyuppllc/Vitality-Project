import Link from 'next/link'
import { requireAdminPage } from '@/lib/vip/page-gate'
import { prisma } from '@/lib/prisma'
import { TIER_BENEFITS } from '@/lib/membership'
import { ARTICLE_CATEGORIES, categoryLabel, readMinutes } from '@/lib/vip/fitness/articles'
import { ArticleForm, FitnessSubNav } from '@/components/admin/vip/fitness-forms'

export const dynamic = 'force-dynamic'

export default async function AdminVipArticlesPage() {
  await requireAdminPage()
  const articles = await prisma.vipArticle.findMany({ orderBy: [{ updatedAt: 'desc' }] })
  return (
    <div>
      <FitnessSubNav />
      <div className="grid gap-6 lg:grid-cols-[1fr_28rem]">
        <section className="glass min-w-0 rounded-2xl p-5">
          <h2 className="mb-1 font-semibold">Lifestyle library</h2>
          <p className="mb-4 text-sm text-white/40">Nutrition, recovery, sleep, mindset and recipes. Members below an article&apos;s tier see its title and summary only.</p>
          {articles.length === 0 ? (
            <p className="text-sm text-white/40">No articles yet.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {articles.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link href={`/admin/vip/fitness/articles/${a.id}`} className="font-medium hover:underline">{a.title}</Link>
                    <p className="text-xs text-white/40">
                      {a.published ? 'Published' : 'Draft'} · {categoryLabel(a.category)} · {TIER_BENEFITS[a.minTier].label} and up ·{' '}
                      {a.body.trim() ? `${readMinutes(a.body)} min read` : 'no body yet'}
                    </p>
                  </div>
                  <Link href={`/admin/vip/fitness/articles/${a.id}`} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10">
                    Edit
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <ArticleForm categories={ARTICLE_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} />
      </div>
    </div>
  )
}
