import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getVipViewer } from '@/lib/vip/access'
import { CERT_CODE_RE } from '@/lib/vip/academy'
import { vipBaseUrl } from '@/lib/vip/email-prefs'
import { MONOGRAM_PATHS } from '@/components/vip/monogram'
import { PrintButton } from '@/components/vip/print-button'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Certificate' }

/**
 * The member's own certificate, full page and print-ready (landscape; the
 * browser's "Save as PDF" makes the PDF). Only the holder (or an admin) can
 * open this page; anyone can check the verification ID at /verify/<code>,
 * which shows no personal details.
 */
export default async function CertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const viewer = await getVipViewer()
  if (!viewer) redirect('/signin')
  const { code: raw } = await params
  const code = decodeURIComponent(raw).toUpperCase()
  if (!CERT_CODE_RE.test(code)) notFound()
  const cert = await prisma.vipCertificate.findUnique({ where: { code } })
  if (!cert || (cert.userId !== viewer.userId && !viewer.isAdmin)) notFound()
  const verifyUrl = `${vipBaseUrl()}/verify/${cert.code}`
  const date = cert.issuedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })

  return (
    <div className="vip-cert-page mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6">
      <style>{`
        @page { size: landscape; margin: 10mm; }
        @media print {
          .vip-cert-page { padding: 0 !important; max-width: none !important; }
          .vip-cert { box-shadow: none !important; border-radius: 0 !important; }
        }
      `}</style>
      <div className="vip-no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/classroom#certificates" className="vip-focus inline-flex min-h-[44px] items-center gap-1.5 rounded-lg text-sm text-white/70 hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Academy
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/verify/${cert.code}`} className="vip-focus inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold hover:bg-white/[0.06]">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Public verification page
          </Link>
          <PrintButton />
        </div>
      </div>

      <main id="main">
        <article
          className="vip-cert relative overflow-hidden rounded-2xl bg-[#fbf8f1] text-[#0b1322] shadow-2xl shadow-black/50"
          style={{ aspectRatio: '1.414 / 1' }}
          aria-label={`Certificate of completion: ${cert.courseTitle}`}
        >
          <div className="absolute inset-[3%] rounded-xl border border-[#b8964f]/60" aria-hidden="true" />
          <div className="absolute inset-[4.2%] rounded-lg border border-[#b8964f]/25" aria-hidden="true" />
          <div className="relative flex h-full flex-col items-center justify-between px-[8%] py-[6%] text-center">
            <div className="flex flex-col items-center">
              <svg viewBox="0 0 64 64" className="h-[clamp(36px,7vw,64px)] w-[clamp(36px,7vw,64px)]" aria-hidden="true">
                <rect x="1" y="1" width="62" height="62" rx="16" fill="#0b1322" />
                <path d={MONOGRAM_PATHS.v} fill="none" stroke="#ffffff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d={MONOGRAM_PATHS.p} fill="none" stroke="#d4b26a" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="mt-[1.5%] text-[clamp(8px,1.3vw,12px)] font-bold uppercase tracking-[0.3em] text-[#3f4757]">The Vitality Project Clubhouse</p>
            </div>
            <div>
              <p className="text-[clamp(10px,1.6vw,15px)] font-semibold uppercase tracking-[0.35em] text-[#6b5320]">Certificate of completion</p>
              <p className="mt-[3%] text-[clamp(10px,1.5vw,14px)] text-[#3f4757]">This certifies that</p>
              <h1 className="mt-[1.5%] font-serif text-[clamp(22px,4.6vw,46px)] font-semibold leading-tight tracking-tight" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                {cert.recipientName}
              </h1>
              <div className="mx-auto mt-[2%] h-px w-2/3 bg-[#b8964f]/60" aria-hidden="true" />
              <p className="mt-[2%] text-[clamp(10px,1.5vw,14px)] text-[#3f4757]">has completed every lesson and module check of</p>
              <p className="mt-[1%] text-[clamp(15px,2.6vw,26px)] font-bold tracking-tight">{cert.courseTitle}</p>
            </div>
            <div className="grid w-full grid-cols-3 items-end gap-4 text-[clamp(7px,1.1vw,11px)] text-[#3f4757]">
              <div className="text-left">
                <p className="font-semibold uppercase tracking-wider text-[#0b1322]">{date}</p>
                <p>Date completed</p>
              </div>
              <div>
                <p className="font-semibold uppercase tracking-wider text-[#0b1322]">The Vitality Project</p>
                <p>Clubhouse Academy</p>
              </div>
              <div className="text-right">
                <p className="font-mono font-semibold tracking-wider text-[#0b1322]">{cert.code}</p>
                <p className="break-all">Verify at {verifyUrl.replace(/^https?:\/\//, '')}</p>
              </div>
            </div>
          </div>
        </article>
        <p className="vip-no-print mt-4 text-center text-xs text-white/60">
          Tip: choose “Save as PDF” in the print dialog to keep a copy. Anyone can confirm this certificate at the verification page — it shows the course and date, never your details.
        </p>
      </main>
    </div>
  )
}
