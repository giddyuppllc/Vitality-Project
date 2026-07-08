import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { z } from 'zod'

const COA_DIR = path.resolve(process.cwd(), 'public', 'coa')

async function ensureDir() {
  await fs.mkdir(COA_DIR, { recursive: true }).catch(() => {})
}

// ── GET /api/admin/coa?q=... — list / search ─────────────────────────────────
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200)

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
    orderBy: [{ productName: 'asc' }, { createdAt: 'desc' }],
    take: limit,
  })

  return NextResponse.json({ records })
}

// ── POST /api/admin/coa — upload new CoA (multipart/form-data) ───────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureDir()

  const formData = await req.formData()

  const schema = z.object({
    productName: z.string().min(1),
    productSlug: z.string().optional(),
    variant: z.string().optional(),
    lotNumber: z.string().min(1),
    testDate: z.string().optional(),
    expiryDate: z.string().optional(),
    purity: z.string().optional(),
    testingLab: z.string().optional(),
    notes: z.string().optional(),
    documentUrl: z.string().optional(), // external URL alternative to file upload
  })

  const fields: Record<string, string> = {}
  formData.forEach((value, key) => {
    if (typeof value === 'string') fields[key] = value
  })

  let parsed
  try {
    parsed = schema.parse(fields)
  } catch (err) {
    return NextResponse.json({ error: 'Invalid form data', detail: String(err) }, { status: 400 })
  }

  let documentUrl = parsed.documentUrl ?? ''
  let fileName: string | null = null

  const file = formData.get('file')
  if (file && file instanceof File && file.size > 0) {
    const safeBase = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
    const id = crypto.randomBytes(8).toString('hex')
    const ext = path.extname(safeBase) || '.pdf'
    const stem = path.basename(safeBase, ext)
    const finalName = `${id}-${stem}${ext}`
    const targetPath = path.join(COA_DIR, finalName)
    const ab = await file.arrayBuffer()
    await fs.writeFile(targetPath, Buffer.from(ab))
    documentUrl = `/coa/${finalName}`
    fileName = file.name
  }

  if (!documentUrl) {
    return NextResponse.json(
      { error: 'Provide either a file upload or an external documentUrl' },
      { status: 400 },
    )
  }

  const created = await prisma.certificateOfAnalysis.create({
    data: {
      productName: parsed.productName.trim(),
      productSlug: parsed.productSlug?.trim() || null,
      variant: parsed.variant?.trim() || null,
      lotNumber: parsed.lotNumber.trim(),
      documentUrl,
      fileName,
      testDate: parsed.testDate ? new Date(parsed.testDate) : null,
      expiryDate: parsed.expiryDate ? new Date(parsed.expiryDate) : null,
      purity: parsed.purity?.trim() || null,
      testingLab: parsed.testingLab?.trim() || null,
      notes: parsed.notes?.trim() || null,
      uploadedById: session.user.id ?? null,
      uploadedByName: session.user.name ?? session.user.email ?? null,
    },
  })

  await logAudit({
    userId: session.user.id ?? undefined,
    userEmail: session.user.email ?? undefined,
    action: 'coa.create',
    entityType: 'CertificateOfAnalysis',
    entityId: created.id,
    metadata: JSON.stringify({ productName: created.productName, lotNumber: created.lotNumber }),
  }).catch(() => {})

  return NextResponse.json({ record: created }, { status: 201 })
}
