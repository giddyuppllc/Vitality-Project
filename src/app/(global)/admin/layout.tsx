export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { AdminSidebar } from '@/components/admin/sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/auth/login')
  }

  return (
    <div className="lg:flex min-h-screen" style={{ background: '#0f0f12', color: '#fff' }}>
      <AdminSidebar />
      {/* min-w-0 lets the content column shrink below its intrinsic width so
          wide tables scroll within their own container instead of pushing the
          whole page wider than the viewport on phones/tablets. */}
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="admin-scope p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  )
}
