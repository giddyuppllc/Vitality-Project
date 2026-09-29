import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { FileText, Plus } from 'lucide-react'
import Link from 'next/link'
import { CoaSearchBar } from '@/components/admin/coa-search-bar'
import { CoaRowActions } from '@/components/admin/coa-row-actions'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function CoaPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/auth/login')

  const { q = '' } = await searchParams
  const trimmed = q.trim()

  const where = trimmed
    ? {
        OR: [
          { productName: { contains: trimmed, mode: 'insensitive' as const } },
          { productSlug: { contains: trimmed, mode: 'insensitive' as const } },
          { lotNumber: { contains: trimmed, mode: 'insensitive' as const } },
          { variant: { contains: trimmed, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const records = await prisma.certificateOfAnalysis.findMany({
    where,
    orderBy: [{ productName: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  })

  // Group by productName so each peptide shows full upload history
  const groups = new Map<string, typeof records>()
  for (const r of records) {
    const key = r.productName
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-6 mb-8 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <FileText className="w-6 h-6 text-brand-400" />
            Certificates of Analysis
          </h1>
          <p className="text-white/40 mt-1 text-sm">
            Search by peptide name, lot number, or strength. Upload new CoAs and review the full history per compound.
          </p>
        </div>
        <Link
          href="/admin/coa/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" /> Upload CoA
        </Link>
      </div>

      <div className="mb-6">
        <CoaSearchBar defaultValue={trimmed} />
      </div>

      {records.length === 0 && (
        <div className="glass rounded-2xl p-12 text-center">
          <FileText className="w-10 h-10 text-white/15 mx-auto mb-4" />
          <p className="text-white/50">
            {trimmed ? `No CoAs match "${trimmed}"` : 'No CoAs uploaded yet.'}
          </p>
          <Link
            href="/admin/coa/new"
            className="inline-flex items-center gap-2 mt-4 text-brand-400 hover:text-brand-300 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Upload the first one
          </Link>
        </div>
      )}

      <div className="space-y-6">
        {[...groups.entries()].map(([productName, items]) => (
          <div key={productName} className="glass rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-white/8 bg-white/[0.02] flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-white">{productName}</h2>
                <p className="text-xs text-white/40">
                  {items.length} record{items.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            <div className="divide-y divide-white/5">
              {items.map((r) => (
                <div key={r.id} className="px-5 py-4 flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-[280px]">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-sm text-brand-300">{r.lotNumber}</span>
                      {r.variant && (
                        <span className="text-xs text-white/60 bg-white/[0.05] px-2 py-0.5 rounded">
                          {r.variant}
                        </span>
                      )}
                      {r.purity && (
                        <span className="text-xs text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded">
                          {r.purity}
                        </span>
                      )}
                      {r.testingLab && (
                        <span className="text-xs text-white/50">
                          via {r.testingLab}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-white/40 flex-wrap">
                      {r.testDate && <span>Tested {formatDate(r.testDate)}</span>}
                      {r.expiryDate && <span>· Expires {formatDate(r.expiryDate)}</span>}
                      <span>· Uploaded {formatDate(r.createdAt)}</span>
                      {r.uploadedByName && <span>by {r.uploadedByName}</span>}
                    </div>
                    {r.notes && (
                      <p className="text-xs text-white/50 mt-1.5 italic">{r.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={r.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-3 py-1.5 rounded-lg bg-brand-500/15 text-brand-300 hover:bg-brand-500/25 hover:text-white transition-colors"
                    >
                      View CoA
                    </a>
                    <CoaRowActions id={r.id} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
