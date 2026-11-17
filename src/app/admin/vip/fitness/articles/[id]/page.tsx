import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireAdminPage } from '@/lib/vip/page-gate'
import { prisma } from '@/lib/prisma'
import { ARTICLE_CATEGORIES, readMinutes } from '@/lib/vip/fitness/articles'
import { renderLessonMarkdown } from '@/lib/vip/text'
import { AdminActionButton } from '@/components/admin/vip/admin-vip-ui'
import { ArticleForm, FitnessSubNav } from '@/components/admin/vip/fitness-forms'

export const dynamic = 'force-dynamic'

// vip.css isn't loaded in the admin, so the preview carries its own prose styling.
const PROSE =
  'text-[15px] leading-relaxed text-white/85 [&_a]:text-brand-300 [&_a]:underline [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-bold [&_h4]:mt-3 [&_h4]:font-bold [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_strong]:text-white [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6'

export default async function AdminVipArticleEditor({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage()
  const { id } = await params
  const article = await prisma.vipArticle.findUnique({ where: { id } })
  if (!article) notFound()
  const minTier = article.minTier === 'NONE' ? 'CLUB' : article.minTier

  return (
    <div>
      <FitnessSubNav />
      <Link href="/admin/vip/fitness/articles" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> All articles
      </Link>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <ArticleForm
            categories={ARTICLE_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
            article={{
              id: article.id,
              title: article.title,
              slug: article.slug,
              summary: article.summary,
              coverImage: article.coverImage,
              body: article.body,
              category: article.category,
              minTier,
              published: article.published,
            }}
          />
          <AdminActionButton
            endpoint="/api/admin/vip/fitness/articles"
            tone="danger"
            label="Delete article"
            confirmText="Delete this article permanently?"
            body={{ op: 'article.delete', id: article.id }}
          />
        </div>
        <section className="glass min-w-0 rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-white/40">Preview (last saved) · {readMinutes(article.body)} min read</p>
          {article.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element -- admin-entered cover URL
            <img src={article.coverImage} alt="" className="mt-3 h-48 w-full rounded-xl object-cover" />
          )}
          <h2 className="mt-3 text-2xl font-bold">{article.title}</h2>
          {article.summary && <p className="mt-1 text-white/60">{article.summary}</p>}
          {article.body.trim() ? (
            <div className={`mt-4 ${PROSE}`} dangerouslySetInnerHTML={{ __html: renderLessonMarkdown(article.body) }} />
          ) : (
            <p className="mt-4 text-sm text-white/40">No body yet — write it in the form and save.</p>
          )}
        </section>
      </div>
    </div>
  )
}
