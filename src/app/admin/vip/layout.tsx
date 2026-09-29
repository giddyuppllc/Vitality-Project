import { Crown } from 'lucide-react'
import { VipAdminTabs } from '@/components/admin/vip/admin-vip-ui'

// Access: the parent src/app/admin/layout.tsx already requires role ADMIN, and
// every /api/admin/vip/* handler re-checks it (requireAdminApi).
export default function AdminVipLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Crown className="h-6 w-6 text-brand-400" />
          Clubhouse
        </h1>
        <p className="mt-1 text-white/40">vitalityproject.vip — community, classroom, events and member rewards.</p>
      </div>
      <VipAdminTabs />
      {children}
    </div>
  )
}
