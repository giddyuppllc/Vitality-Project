import { NextRequest } from 'next/server'
import { recordClickAndRedirect } from '@/lib/affiliate-tracking'

// Friendly affiliate link alias: /ref/<CODE>
// Same behavior as /r/<CODE> — covers the format shown on the
// affiliate-account page (`${appUrl}/ref/${code}`).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  const to = new URL(req.url).searchParams.get('to') ?? '/'
  return recordClickAndRedirect(req, code, to)
}
