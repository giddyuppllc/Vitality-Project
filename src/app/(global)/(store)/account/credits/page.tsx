export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatPrice, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { TIER_THRESHOLDS, tierForLifetimeSpend } from '@/lib/loyalty'
import { Sparkles, Wallet, Trophy } from 'lucide-react'

export default async function CreditsRewardsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth/login')

  const [loyalty, storeCredit] = await Promise.all([
    prisma.loyaltyAccount.findUnique({
      where: { userId: session.user.id },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    }),
    prisma.storeCredit.findUnique({
      where: { userId: session.user.id },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    }),
  ])

  const points = loyalty?.points ?? 0
  const lifetimeSpend = loyalty?.lifetimeSpend ?? 0
  const tier = tierForLifetimeSpend(lifetimeSpend)
  const creditBalance = storeCredit?.balance ?? 0

  // Find next tier + progress
  const tiers: Array<{ name: keyof typeof TIER_THRESHOLDS; threshold: number }> = [
    { name: 'BRONZE', threshold: TIER_THRESHOLDS.BRONZE },
    { name: 'SILVER', threshold: TIER_THRESHOLDS.SILVER },
    { name: 'GOLD', threshold: TIER_THRESHOLDS.GOLD },
    { name: 'PLATINUM', threshold: TIER_THRESHOLDS.PLATINUM },
  ]
  const currentTierIdx = tiers.findIndex((t) => t.name === tier)
  const nextTier = tiers[currentTierIdx + 1] ?? null
  const currentThreshold = tiers[currentTierIdx].threshold
  const nextThreshold = nextTier?.threshold ?? currentThreshold
  const progress = nextTier
    ? Math.min(
        100,
        Math.round(
          ((lifetimeSpend - currentThreshold) / (nextThreshold - currentThreshold)) * 100
        )
      )
    : 100
  const toGo = nextTier ? Math.max(0, nextThreshold - lifetimeSpend) : 0

  const tierColor: Record<string, string> = {
    BRONZE: 'text-amber-600',
    SILVER: 'text-white/70',
    GOLD: 'text-amber-400',
    PLATINUM: 'text-brand-400',
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-brand-400" />
          Credits & Rewards
        </h1>
        <p className="text-white/40 mt-1">Store credit, loyalty points, and tier progress.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Store Credit */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-emerald-400" />
              <h2 className="font-semibold">Store Credit</h2>
            </div>
          </div>
          <p className="text-3xl font-bold">{formatPrice(creditBalance)}</p>
          <p className="text-xs text-white/40 mt-2">
            Applied automatically at checkout when you opt in.
          </p>
        </div>

        {/* Loyalty */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Trophy className={`w-5 h-5 ${tierColor[tier]}`} />
              <h2 className="font-semibold">Loyalty Points</h2>
            </div>
            <Badge variant="info">{tier}</Badge>
          </div>
          <p className="text-3xl font-bold">{points.toLocaleString()} <span className="text-base text-white/40">pts</span></p>
          <p className="text-xs text-white/40 mt-2">
            Worth {formatPrice(points)} at checkout (100 pts = $1).
          </p>
        </div>
      </div>

      {/* Tier progress */}
      <div className="glass rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold">Tier Progress</h2>
            <p className="text-xs text-white/40 mt-1">
              Lifetime spend: <span className="text-white">{formatPrice(lifetimeSpend)}</span>
            </p>
          </div>
          {nextTier && (
            <p className="text-sm text-white/60 text-right">
              <span className="text-white font-medium">{formatPrice(toGo)}</span> to {nextTier.name}
            </p>
          )}
          {!nextTier && (
            <p className="text-sm text-brand-400 font-medium">
              Max tier reached
            </p>
          )}
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-purple-400 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-white/40 mt-3">
          {tiers.map((t) => (
            <div key={t.name} className={t.name === tier ? 'text-white font-medium' : ''}>
              {t.name} {t.threshold > 0 && `(${formatPrice(t.threshold)})`}
            </div>
          ))}
        </div>
      </div>

      {/* Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-5">Loyalty History</h2>
          {(!loyalty || loyalty.transactions.length === 0) && (
            <p className="text-sm text-white/40">No loyalty activity yet.</p>
          )}
          <div className="space-y-3">
            {loyalty?.transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm truncate">{t.description}</p>
                  <p className="text-xs text-white/40">{formatDate(t.createdAt)} · {t.type}</p>
                </div>
                <p className={`text-sm font-bold shrink-0 ml-3 ${t.points >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {t.points >= 0 ? '+' : ''}
                  {t.points}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-5">Store Credit History</h2>
          {(!storeCredit || storeCredit.transactions.length === 0) && (
            <p className="text-sm text-white/40">No store credit activity yet.</p>
          )}
          <div className="space-y-3">
            {storeCredit?.transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm truncate">{t.description}</p>
                  <p className="text-xs text-white/40">{formatDate(t.createdAt)} · {t.type}</p>
                </div>
                <p className={`text-sm font-bold shrink-0 ml-3 ${t.amount >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {t.amount >= 0 ? '+' : ''}
                  {formatPrice(t.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
