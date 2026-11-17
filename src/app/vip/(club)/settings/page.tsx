import Link from 'next/link'
import { ArrowRight, Smartphone, Sparkles } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireVipPage } from '@/lib/vip/page-gate'
import { GLOBAL_LINKS } from '@/lib/vip/links'
import { PageHeader, TierBadge } from '@/components/vip/ui'
import { EmailPrefsForm } from '@/components/vip/email-prefs-form'
import { SignOutButton } from '@/components/vip/sign-out-button'
import { InstallApp } from '@/components/vip/install-app'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const viewer = await requireVipPage('member')
  const profile = await prisma.vipProfile.findUnique({
    where: { userId: viewer.userId },
    select: { emailDigest: true, emailEvents: true, emailRewards: true },
  })

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" intro="Notifications, the Clubhouse app on your phone, and your account." />

      <EmailPrefsForm
        initial={{
          emailDigest: profile?.emailDigest ?? true,
          emailEvents: profile?.emailEvents ?? true,
          emailRewards: profile?.emailRewards ?? true,
        }}
      />

      <section className="vip-surface mt-5 p-5" aria-labelledby="app-h">
        <h2 id="app-h" className="flex items-center gap-2 font-semibold">
          <Smartphone className="h-4 w-4 text-brand-300" aria-hidden="true" /> The Clubhouse on your phone
        </h2>
        <p className="mt-1 mb-3 text-sm text-white/65">Install it to your home screen for one-tap access, full screen and no browser bar.</p>
        <InstallApp />
      </section>

      <section className="vip-surface mt-5 p-5" aria-labelledby="personal-h">
        <h2 id="personal-h" className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-4 w-4 text-[#d4b26a]" aria-hidden="true" /> Goals and learning path
        </h2>
        <p className="mt-1 text-sm text-white/65">Update your interests, goals and the learning path you’re following.</p>
        <Link href="/welcome" className="vip-focus mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/15 px-4 text-sm font-semibold hover:bg-white/[0.06]">
          Revisit your setup <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>

      <section className="vip-surface mt-5 space-y-3 p-5 text-sm" aria-labelledby="account-h">
        <h2 id="account-h" className="font-semibold">Account</h2>
        <div className="flex flex-wrap items-center gap-2 text-white/70">
          Membership: <TierBadge tier={viewer.tier} admin={viewer.isAdmin} />
        </div>
        <p className="text-white/65">Signed in as {viewer.email}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <a href={GLOBAL_LINKS.manageMembership()} className="vip-focus inline-flex min-h-[44px] items-center rounded-xl border border-white/15 px-3.5 font-medium hover:bg-white/[0.06]">
            Manage membership
          </a>
          <a href={GLOBAL_LINKS.resetPassword()} className="vip-focus inline-flex min-h-[44px] items-center rounded-xl border border-white/15 px-3.5 font-medium hover:bg-white/[0.06]">
            Change password
          </a>
          <SignOutButton />
        </div>
      </section>
    </div>
  )
}
