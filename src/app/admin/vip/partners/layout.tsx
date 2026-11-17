import { AdminSubTabs } from '@/components/admin/vip/sub-tabs'

// Chrome only — every page below calls requireAdminPage() itself.
export default function AdminPartnersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <AdminSubTabs
        label="Partner network admin"
        tabs={[
          { href: '/admin/vip/partners', label: 'Partners', exact: true },
          { href: '/admin/vip/partners/statements', label: 'Statements' },
        ]}
      />
      {children}
    </div>
  )
}
