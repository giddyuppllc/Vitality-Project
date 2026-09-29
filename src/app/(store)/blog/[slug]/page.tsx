import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPostBySlug } from '@/lib/posts'

interface Props {
  params: Promise<{ slug: string }>
}

// Revalidate hourly so edits/new posts appear without a deploy.
export const revalidate = 3600

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) return { title: 'Post Not Found' }
  return {
    title: `${post.title} — The Vitality Project`,
    description: post.excerpt,
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    datePublished: post.date,
    description: post.excerpt,
    publisher: {
      '@type': 'Organization',
      name: 'The Vitality Project',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="mb-10">
          <span className="text-xs font-medium uppercase tracking-widest text-brand-400 mb-3 inline-block">
            {post.category}
          </span>
          <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
          <div className="flex items-center gap-4 text-sm text-white/40">
            <time dateTime={post.date}>
              {new Date(post.date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </time>
            <span>·</span>
            <span>{post.readTime}</span>
          </div>
        </div>

        {/* Content */}
        <div
          className="prose prose-invert prose-p:text-white/60 prose-p:leading-relaxed prose-headings:text-white max-w-none space-y-5 mb-12"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Related Links */}
        {post.relatedLinks.length > 0 && (
          <div className="glass rounded-2xl p-6 mb-10">
            <h2 className="text-sm font-medium uppercase tracking-widest text-white/40 mb-4">
              Related
            </h2>
            <div className="flex flex-wrap gap-3">
              {post.relatedLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-brand-400 hover:text-brand-300 transition-colors underline underline-offset-4"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Back link */}
        <Link
          href="/blog"
          className="text-sm text-white/40 hover:text-white transition-colors"
        >
          ← Back to Blog
        </Link>
      </article>
    </>
  )
}
