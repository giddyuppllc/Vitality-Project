import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import fs from 'fs/promises'
import path from 'path'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const existing = await prisma.certificateOfAnalysis.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Best-effort: delete uploaded file if it lives in /public/coa — and ONLY
  // there: a stored URL like /coa/../../x must never unlink outside it.
  if (existing.documentUrl?.startsWith('/coa/')) {
    const coaDir = path.resolve(process.cwd(), 'public', 'coa')
    const filePath = path.resolve(process.cwd(), 'public', existing.documentUrl.replace(/^\//, ''))
    if (path.dirname(filePath) === coaDir) {
      await fs.unlink(filePath).catch(() => {})
    }
  }

  await prisma.certificateOfAnalysis.delete({ where: { id } })

  await logAudit({
    userId: session.user.id ?? undefined,
    userEmail: session.user.email ?? undefined,
    action: 'coa.delete',
    entityType: 'CertificateOfAnalysis',
    entityId: id,
    metadata: JSON.stringify({ productName: existing.productName, lotNumber: existing.lotNumber }),
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
