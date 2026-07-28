/**
 * One-time (idempotent) import of the legacy static blog posts
 * (src/lib/blog-data.ts) into the DB-driven `posts` table.
 *
 * Run AFTER the Post table exists:
 *   npx prisma migrate deploy   # or: npx prisma db push
 *   npm run seed:posts
 *
 * Upserts by slug, so re-running refreshes content without creating duplicates.
 * Existing posts are published with their original date.
 */
import { PrismaClient } from '@prisma/client'
import { blogPosts } from '../src/lib/blog-data'

const prisma = new PrismaClient()

async function main() {
  let created = 0
  let updated = 0
  for (const p of blogPosts) {
    const existing = await prisma.post.findUnique({ where: { slug: p.slug }, select: { id: true } })
    await prisma.post.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        content: p.content,
        category: p.category,
        readTime: p.readTime,
        relatedLinks: p.relatedLinks,
        published: true,
        publishedAt: new Date(`${p.date}T12:00:00Z`),
      },
      update: {
        title: p.title,
        excerpt: p.excerpt,
        content: p.content,
        category: p.category,
        readTime: p.readTime,
        relatedLinks: p.relatedLinks,
      },
    })
    if (existing) updated++
    else created++
  }
  console.log(`Seeded posts: ${created} created, ${updated} updated (${blogPosts.length} total).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
