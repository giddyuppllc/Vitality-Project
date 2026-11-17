import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { staffPartners, recentPartnerTxns } from '@/lib/vip/partners'
import { REWARDS_COPY as C } from '@/lib/vip/rewards-copy'
import { Wordmark } from '@/components/vip/ui'
import { SignOutButton } from '@/components/vip/sign-out-button'
import { PartnerPortal } from '@/components/vip/rewards/partner-portal'
import { PortalSignIn } from '@/components/vip/rewards/portal-signin'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Partner portal' }

/**
 * Partner portal (vitalityproject.vip/partners/portal) — for the staff of
 * partner businesses, who need not be members. The page and every API call
 * check VipPartnerStaff; nothing here is visible to anyone else.
 */
export default async function PartnerPortalPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id ?? null
  const mine = userId ? await staffPartners(userId) : []

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/[0.07] bg-[#070b14]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/partners/portal" className="vip-focus rounded-xl">
            <Wordmark />
          </Link>
          <span className="vip-kicker hidden sm:inline">{C.portalTitle}</span>
          {userId && <SignOutButton />}
        </div>
      </header>
      <main id="main" className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {!userId ? (
          <div className="mx-auto max-w-md">
            <div className="vip-surface-strong p-6">
              <h1 className="text-xl font-bold">{C.portalTitle}</h1>
              <p className="mt-1 text-sm text-white/60">{C.portalSignin}</p>
              <PortalSignIn />
            </div>
          </div>
        ) : mine.length === 0 ? (
          <div className="vip-surface-strong mx-auto max-w-md p-6">
            <h1 className="text-xl font-bold">{C.portalTitle}</h1>
            <p className="mt-2 text-sm text-white/65">{C.portalNoAccess}</p>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <h1 className="text-2xl font-bold tracking-tight">{mine.length === 1 ? mine[0].partner.name : C.portalTitle}</h1>
              <p className="mt-1 text-[15px] text-white/60">{C.portalIntro}</p>
            </div>
            <PartnerPortal
              partners={mine.map((m) => ({
                id: m.partner.id,
                name: m.partner.name,
                earnPointsPerDollar: m.partner.earnPointsPerDollar,
                allowRedemption: m.partner.allowRedemption,
              }))}
              initialPartnerId={mine[0].partner.id}
              initialTxns={await recentPartnerTxns(mine[0].partner.id)}
              earnRate={mine[0].partner.earnPointsPerDollar}
            />
          </>
        )}
      </main>
    </div>
  )
}
