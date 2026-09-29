export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'
import { InviteStaffForm } from '@/components/business/invite-staff-form'

export default async function BusinessStaffPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const membership = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
  })

  if (!membership) redirect('/business/apply')

  const isOwnerOrAdmin = membership.role === 'OWNER' || membership.role === 'ADMIN'

  const members = await prisma.orgMember.findMany({
    where: { organizationId: membership.organizationId },
    include: {
      user: { select: { name: true, email: true } },
      location: { select: { name: true } },
    },
    orderBy: { role: 'asc' },
  })

  const roleVariant = (role: string) =>
    role === 'OWNER' ? 'info' : role === 'ADMIN' ? 'success' : 'default'

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Staff</h1>
          <p className="text-white/40 mt-1">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {isOwnerOrAdmin && (
        <div className="glass rounded-2xl p-6 mb-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-400" /> Invite Staff Member
          </h2>
          <InviteStaffForm />
        </div>
      )}

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left">
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Name</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Email</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Role</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Location</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-white/2 transition-colors">
                <td className="px-5 py-4 text-sm font-medium">{member.user.name || 'N/A'}</td>
                <td className="px-5 py-4 text-sm text-white/60">{member.user.email}</td>
                <td className="px-5 py-4">
                  <Badge variant={roleVariant(member.role)}>{member.role}</Badge>
                </td>
                <td className="px-5 py-4 text-sm text-white/40">{member.location?.name || 'All locations'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
