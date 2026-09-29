import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { FileText, ShieldCheck, Beaker, ExternalLink } from 'lucide-react'
import { CoaPublicSearchBar } from '@/components/store/coa-public-search-bar'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Certificates of Analysis — The Vitality Project',
  description:
    'Look up a Certificate of Analysis (CoA) for any compound by name, lot number, or strength. Third-party verified purity for every batch.',
}

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function PublicCoaPage({ searchParams }: Props) {
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
    take: 200,
  })

  // Group by productName for clean per-compound history
  const groups = new Map<string, typeof records>()
  for (const r of records) {
    const key = r.productName
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 glass-subtle rounded-full px-4 py-1.5 text-sm text-brand-300 mb-5">
          <ShieldCheck className="w-3.5 h-3.5" />
          Third-Party Verified
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold mb-3 leading-tight">
          Certificates of Analysis
        </h1>
        <p className="text-white/55 max-w-2xl mx-auto leading-relaxed">
          Every batch is sent to an independent lab for purity, identity, and contamination testing. Look up the CoA for any compound by name, lot number, or strength. Full history is preserved.
        </p>
      </div>

      {/* Search */}
      <div className="mb-8">
        <CoaPublicSearchBar defaultValue={trimmed} />
      </div>

      {/* Trust strip */}
      <div className="grid grid-cols-3 gap-3 mb-10">
        {[
          { icon: ShieldCheck, label: '≥98% purity standard' },
          { icon: Beaker, label: 'Independent third-party labs' },
          { icon: FileText, label: 'Full lot history retained' },
        ].map((b) => (
          <div
            key={b.label}
            className="glass rounded-xl p-3 flex items-center gap-2 text-xs text-white/65"
          >
            <b.icon className="w-3.5 h-3.5 text-brand-300 shrink-0" />
            <span className="leading-tight">{b.label}</span>
          </div>
        ))}
      </div>

      {/* No results */}
      {records.length === 0 && (
        <div className="glass rounded-2xl p-12 text-center">
          <FileText className="w-10 h-10 text-white/15 mx-auto mb-4" />
          {trimmed ? (
            <>
              <p className="text-white/60">
                No certificates match <strong className="text-white">"{trimmed}"</strong> yet.
              </p>
              <p className="text-white/40 text-sm mt-2">
                Try the compound name (e.g. "BPC-157") or a lot number from your packaging.
              </p>
            </>
          ) : (
            <p className="text-white/50">Type a compound name or lot number to begin.</p>
          )}
        </div>
      )}

      {/* Results, grouped by compound */}
      <div className="space-y-5">
        {[...groups.entries()].map(([productName, items]) => (
          <div key={productName} className="glass rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-white/8 bg-white/[0.02] flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-semibold text-white">{productName}</h2>
                <p className="text-xs text-white/40">
                  {items.length} certificate{items.length === 1 ? '' : 's'} on file
                </p>
              </div>
              {items[0].productSlug && (
                <a
                  href={`/products/${items[0].productSlug}`}
                  className="text-[11px] text-brand-300 hover:text-brand-200 inline-flex items-center gap-1"
                >
                  View product <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <div className="divide-y divide-white/5">
              {items.map((r) => (
                <div
                  key={r.id}
                  className="px-5 py-4 flex items-center gap-4 flex-wrap"
                >
                  <div className="flex-1 min-w-[260px]">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-sm text-brand-300">{r.lotNumber}</span>
                      {r.variant && (
                        <span className="text-xs text-white/65 bg-white/[0.05] px-2 py-0.5 rounded">
                          {r.variant}
                        </span>
                      )}
                      {r.purity && (
                        <span className="text-xs text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded font-semibold">
                          {r.purity}
                        </span>
                      )}
                      {r.testingLab && (
                        <span className="text-xs text-white/45">via {r.testingLab}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-white/40 flex-wrap">
                      {r.testDate && <span>Tested {formatDate(r.testDate)}</span>}
                      {r.expiryDate && <span>· Expires {formatDate(r.expiryDate)}</span>}
                    </div>
                  </div>
                  <a
                    href={r.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-4 py-2 rounded-lg bg-brand-500/15 hover:bg-brand-500/25 text-brand-300 hover:text-white transition-colors inline-flex items-center gap-1.5 font-medium"
                  >
                    View CoA
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div className="mt-10 glass rounded-2xl p-5 text-center">
        <p className="text-xs text-white/40 leading-relaxed">
          Can't find the lot you're looking for? It may be older than our public catalog or for an internal R&D batch.{' '}
          <a href="/contact" className="text-brand-300 hover:text-brand-200">
            Contact us
          </a>{' '}
          and we'll dig it up.
        </p>
      </div>
    </div>
  )
}
