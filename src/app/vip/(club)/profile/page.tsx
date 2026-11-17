import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireVipPage } from '@/lib/vip/page-gate'
import { GLOBAL_LINKS } from '@/lib/vip/links'
import { listMyBlocks, readDmPolicy, readVisibility } from '@/lib/vip/social'
import { Avatar, PageHeader, TierBadge } from '@/components/vip/ui'
import { ProfileForm } from '@/components/vip/profile-form'
import { SignOutButton } from '@/components/vip/sign-out-button'
import { EmailPrefsForm } from '@/components/vip/email-prefs-form'
import { UnblockButton } from '@/components/vip/profile-actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Your profile' }

export default async function MyProfilePage() {
  const viewer = await requireVipPage('member')
  const [profile, interests, blocks] = await Promise.all([
    prisma.vipProfile.findUnique({
      where: { userId: viewer.userId },
      select: {
        displayName: true,
        bio: true,
        avatarUrl: true,
        coverUrl: true,
        location: true,
        profileVisibility: true,
        dmPolicy: true,
        emailDigest: true,
        emailEvents: true,
        emailRewards: true,
      },
    }),
    prisma.vipInterest.findMany({ where: { userId: viewer.userId }, orderBy: { tag: 'asc' }, select: { tag: true } }),
    viewer.suspended ? Promise.resolve([]) : listMyBlocks(viewer),
  ])

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
        initial={{
          displayName: profile?.displayName ?? null,
          bio: profile?.bio ?? null,
          avatarUrl: profile?.avatarUrl ?? null,
          coverUrl: profile?.coverUrl ?? null,
          location: profile?.location ?? null,
          interests: interests.map((i) => i.tag),
          profileVisibility: readVisibility(profile?.profileVisibility),
          dmPolicy: readDmPolicy(profile?.dmPolicy),
        }}
        fallbackName={viewer.name || viewer.username || 'Member'}
        disabled={viewer.suspended}
      />
      <EmailPrefsForm
        initial={{
          emailDigest: profile?.emailDigest ?? true,
          emailEvents: profile?.emailEvents ?? true,
          emailRewards: profile?.emailRewards ?? true,
        }}
      />
      {!viewer.suspended && (
        <section className="vip-surface mt-5 p-5 text-sm" aria-labelledby="blocked-h">
          <h2 id="blocked-h" className="font-semibold">Blocked members</h2>
          {blocks.length === 0 ? (
            <p className="mt-2 text-white/60">You haven’t blocked anyone. Block a member from their profile or the … menu on their post.</p>
          ) : (
            <ul className="mt-3 divide-y divide-white/[0.06]">
              {blocks.map((b) => (
                <li key={b.id} className="flex items-center gap-3 py-2.5">
                  <Avatar name={b.displayName} src={b.avatarUrl} size={34} />
                  <span className="min-w-0 flex-1 truncate font-medium">{b.displayName}</span>
                  <UnblockButton userId={b.id} name={b.displayName} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
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
