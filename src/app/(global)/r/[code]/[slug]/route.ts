import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordClickAndRedirect } from '@/lib/affiliate-tracking'

// Custom affiliate link: /r/<CODE>/<SLUG>
// Looks up the AffiliateLink row (slug is unique) and redirects to its
// stored destination URL. Falls back to the home page if the slug doesn't
// resolve.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; slug: string }> },
) {
  const { code, slug } = await params
  const link = await prisma.affiliateLink.findUnique({
    where: { slug },
    include: { affiliate: { select: { code: true, status: true } } },
  })

  // Guard: link must exist, belong to this code, and the affiliate must be active.
  if (
    !link ||
    !link.active ||
    link.affiliate.code !== code.toUpperCase() ||
    link.affiliate.status !== 'ACTIVE'
  ) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return recordClickAndRedirect(req, code, link.url, { slug })
}
