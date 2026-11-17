import { PageHeader } from '@/components/vip/ui'
import { RewardsTabs } from '@/components/vip/rewards/rewards-tabs'
import { REWARDS_COPY } from '@/lib/vip/rewards-copy'

/**
 * Chrome only (title + sub-navigation). Every page below calls
 * requireVipPage itself — a layout is not an access check.
 */
export default function RewardsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={REWARDS_COPY.title} intro={REWARDS_COPY.intro} />
      <RewardsTabs />
      {children}
    </div>
  )
}
