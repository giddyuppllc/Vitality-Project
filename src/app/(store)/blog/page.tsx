import type { Metadata } from 'next'
import Link from 'next/link'
import { getPublishedPosts } from '@/lib/posts'

export const metadata: Metadata = {
  title: 'Blog — The Vitality Project',
  description:
    'News, analysis, and perspectives on the peptide research landscape.',
}

// Revalidate hourly so newly published posts appear without a deploy.
export const revalidate = 3600

export default async function BlogPage() {
  const blogPosts = await getPublishedPosts()
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">Insights &amp; Research</h1>
        <p className="text-white/50 text-lg leading-relaxed">
          News, analysis, and perspectives on the peptide research landscape.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {blogPosts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="glass rounded-2xl p-6 flex flex-col hover:border-brand-500/30 transition-colors group"
          >
            <span className="text-xs font-medium uppercase tracking-widest text-brand-400 mb-3">
              {post.category}
            </span>
            <h2 className="text-lg font-bold mb-2 group-hover:text-brand-400 transition-colors">
              {post.title}
            </h2>
            <p className="text-white/50 text-sm leading-relaxed line-clamp-2 mb-4">
              {post.excerpt}
            </p>
            <div className="mt-auto flex items-center justify-between text-xs text-white/30">
              <span>
                {new Date(post.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              <span>{post.readTime}</span>
            </div>
            <span className="text-brand-400 text-sm font-medium mt-4 group-hover:translate-x-1 transition-transform inline-block">
              Read More →
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
