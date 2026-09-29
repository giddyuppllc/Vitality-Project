import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireVipPage } from '@/lib/vip/page-gate'
import { GLOBAL_LINKS } from '@/lib/vip/links'
import { PageHeader, TierBadge } from '@/components/vip/ui'
import { ProfileForm } from '@/components/vip/profile-form'
import { SignOutButton } from '@/components/vip/sign-out-button'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Your profile' }

export default async function MyProfilePage() {
  const viewer = await requireVipPage('member')
  const profile = await prisma.vipProfile.findUnique({
    where: { userId: viewer.userId },
    select: { displayName: true, bio: true, avatarUrl: true },
  })

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Your profile">
        {!viewer.suspended && (
          <Link href={`/members/${viewer.userId}`} className="text-sm text-brand-300 hover:text-brand-200">
            View as members see it →
          </Link>
        )}
      </PageHeader>
      <ProfileForm
        initial={profile ?? { displayName: null, bio: null, avatarUrl: null }}
        fallbackName={viewer.name || viewer.username || 'Member'}
        disabled={viewer.suspended}
      />
      <section className="vip-surface mt-5 space-y-3 p-5 text-sm" aria-labelledby="account-h">
        <h2 id="account-h" className="font-semibold">Account</h2>
        <div className="flex flex-wrap items-center gap-2 text-white/65">
          Membership: <TierBadge tier={viewer.tier} admin={viewer.isAdmin} />
        </div>
        <p className="text-white/55">Signed in as {viewer.email}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <a href={GLOBAL_LINKS.manageMembership()} className="vip-focus rounded-xl border border-white/15 px-3.5 py-2 font-medium hover:bg-white/[0.06]">
            Manage membership at vitalityproject.global
          </a>
          <SignOutButton />
        </div>
      </section>
    </div>
  )
}
