import { AdminSubTabs } from '@/components/admin/vip/sub-tabs'

// Chrome only — every page below calls requireAdminPage() itself.
export default function AdminRewardsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <AdminSubTabs
        label="Rewards admin"
        tabs={[
          { href: '/admin/vip/rewards', label: 'Monthly credit', exact: true },
          { href: '/admin/vip/rewards/catalog', label: 'Catalog' },
          { href: '/admin/vip/rewards/redemptions', label: 'Redemptions' },
          { href: '/admin/vip/rewards/earning', label: 'Earning rules' },
          { href: '/admin/vip/rewards/points', label: 'Points & adjustments' },
        ]}
      />
      {children}
    </div>
  )
}
