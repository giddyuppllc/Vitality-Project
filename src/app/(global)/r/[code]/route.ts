import { NextRequest } from 'next/server'
import { recordClickAndRedirect } from '@/lib/affiliate-tracking'

// Short affiliate link: /r/<CODE>
// Optional `?to=<path>` overrides the destination; defaults to the storefront
// home so the visitor lands somewhere even if no destination was supplied.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  const to = new URL(req.url).searchParams.get('to') ?? '/'
  return recordClickAndRedirect(req, code, to)
}
