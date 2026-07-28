import Link from 'next/link'
import { FileText, ShieldCheck, ExternalLink } from 'lucide-react'

export interface ProductCoa {
  id: string
  variant: string | null
  lotNumber: string
  documentUrl: string
  purity: string | null
  testingLab: string | null
  testDate: Date | null
}

function fmtDate(d: Date | null): string | null {
  if (!d) return null
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Third-party lab reports (Certificates of Analysis) for a product, keyed to it
 * by slug/name in the admin CoA manager. Renders nothing when there are none, so
 * the section only appears for products that actually have a report on file.
 */
export function ProductCoaSection({ coas }: { coas: ProductCoa[] }) {
  if (coas.length === 0) return null

  return (
    <section className="mt-12" id="coa" aria-labelledby="coa-heading">
      <div className="flex items-center gap-2 mb-6">
        <ShieldCheck className="w-6 h-6 text-brand-400" />
        <h2 id="coa-heading" className="text-2xl font-bold">
          Third-Party Lab Testing
        </h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {coas.map((coa) => {
          const tested = fmtDate(coa.testDate)
          return (
            <a
              key={coa.id}
              href={coa.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="glass rounded-2xl p-5 flex items-start gap-4 hover:border-brand-500/30 transition-colors group"
            >
              <div className="shrink-0 w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-brand-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {coa.purity && (
                    <span className="text-lg font-bold text-brand-400">{coa.purity}</span>
                  )}
                  <span className="text-sm font-medium text-white/80">purity</span>
                  {coa.variant && (
                    <span className="text-xs text-white/40">· {coa.variant}</span>
                  )}
                </div>
                <p className="text-xs text-white/40 mt-1 leading-relaxed">
                  {coa.testingLab && <>Tested by {coa.testingLab} · </>}
                  Lot {coa.lotNumber}
                  {tested && <> · {tested}</>}
                </p>
                <span className="inline-flex items-center gap-1 text-sm text-brand-400 font-medium mt-2 group-hover:translate-x-0.5 transition-transform">
                  View report <ExternalLink className="w-3.5 h-3.5" />
                </span>
              </div>
            </a>
          )
        })}
      </div>

      <p className="text-[11px] text-white/25 mt-3">
        Reports are provided for transparency. Search all certificates on our{' '}
        <Link href="/coa" className="underline underline-offset-2 hover:text-white/50">
          Certificates of Analysis
        </Link>{' '}
        page.
      </p>
    </section>
  )
}
