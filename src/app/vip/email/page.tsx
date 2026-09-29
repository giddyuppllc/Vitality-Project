import { VIP_COPY } from '@/lib/vip/copy'
import { KIND_LABELS, verifyPrefToken } from '@/lib/vip/email-prefs'
import { PublicPage } from '@/components/vip/public-page'
import { EmailOptOut } from '@/components/vip/email-opt-out'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Email preferences' }

/**
 * Landing page for the signed links in clubhouse emails. Showing it changes
 * nothing; the member confirms with a button (POST /api/vip/email-prefs).
 */
export default async function EmailPrefsPage({ searchParams }: { searchParams: Promise<{ u?: string; k?: string; t?: string }> }) {
  const { u = '', k = '', t = '' } = await searchParams
  const valid = !!u && verifyPrefToken(u, k, t)
  const E = VIP_COPY.emailPage
  return (
    <PublicPage narrow>
      <div className="vip-surface-strong mt-6 p-6">
        <h1 className="text-xl font-bold">{E.title}</h1>
        {valid ? (
          <EmailOptOut u={u} k={k} t={t} label={KIND_LABELS[k as keyof typeof KIND_LABELS]} />
        ) : (
          <p className="mt-2 text-sm text-white/65">{E.invalid}</p>
        )}
      </div>
    </PublicPage>
  )
}
