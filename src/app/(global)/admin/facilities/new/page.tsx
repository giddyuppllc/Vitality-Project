import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { FacilityForm } from '@/components/admin/facility-form'
import { ArrowLeft } from 'lucide-react'

export default async function AdminNewFacilityPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/auth/login')

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin/facilities" className="text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">New Facility</h1>
      </div>

      <div className="max-w-4xl">
        <FacilityForm mode="create" />
      </div>
    </div>
  )
}
