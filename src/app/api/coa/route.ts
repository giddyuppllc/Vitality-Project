import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ── Public read-only CoA search ────────────────────────────────────────────
// No auth required. Returns sanitized records (no internal `notes`,
// no `uploadedById`, no `uploadedByName`).

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 100)

  const where = q
    ? {
        OR: [
          { productName: { contains: q, mode: 'insensitive' as const } },
          { productSlug: { contains: q, mode: 'insensitive' as const } },
          { lotNumber: { contains: q, mode: 'insensitive' as const } },
          { variant: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const records = await prisma.certificateOfAnalysis.findMany({
    where,
    select: {
      id: true,
      productName: true,
      productSlug: true,
      variant: true,
      lotNumber: true,
      documentUrl: true,
      fileName: true,
      testDate: true,
      expiryDate: true,
      purity: true,
      testingLab: true,
      createdAt: true,
    },
    orderBy: [{ productName: 'asc' }, { createdAt: 'desc' }],
    take: limit,
  })

  return NextResponse.json({ records })
}
