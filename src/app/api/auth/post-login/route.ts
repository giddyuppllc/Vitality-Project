import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Computes where a freshly-authenticated user should land.
//
// Why an endpoint instead of reading the session role on the client:
// affiliates are NOT guaranteed to carry `role = AFFILIATE` on their user
// row — the apply/approve flow only writes the `Affiliate` record, leaving
// most affiliates as `CUSTOMER`. So affiliate status has to be resolved by
// looking up the Affiliate table server-side, which the JWT/session does not
// carry. Admins are routed by role; everyone else falls through to the store.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ path: '/' })
  }

  if (session.user.role === 'ADMIN') {
    return NextResponse.json({ path: '/admin' })
  }

  const affiliate = await prisma.affiliate.findUnique({
    where: { userId: session.user.id },
    select: { status: true },
  })

  // Active affiliates (and pending applicants who should see their review
  // status) land on their dashboard rather than the storefront.
  if (affiliate && (affiliate.status === 'ACTIVE' || affiliate.status === 'PENDING')) {
    return NextResponse.json({ path: '/account/affiliate' })
  }

  return NextResponse.json({ path: '/' })
}
