export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { GrantCreditsForm } from '@/components/admin/grant-credits-form'
import { Sparkles, Wallet } from 'lucide-react'

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function AdminCreditsPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/auth/login')

  const { q } = await searchParams

  const users = await prisma.user.findMany({
    where: {
      role: 'CUSTOMER',
      ...(q && q.trim()
        ? {
            OR: [
              { email: { contains: q.trim(), mode: 'insensitive' as const } },
              { name: { contains: q.trim(), mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    include: {
      loyalty: true,
      storeCredit: true,
    },
    take: 100,
    orderBy: { createdAt: 'desc' },
  })

  const totalCredit = await prisma.storeCredit.aggregate({
    _sum: { balance: true },
  })
  const totalPoints = await prisma.loyaltyAccount.aggregate({
    _sum: { points: true },
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-brand-400" />
          Credits & Loyalty
        </h1>
        <p className="text-white/40 mt-1">
          Manage customer store credit and loyalty points balances.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/40">Outstanding Store Credit</span>
            <Wallet className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold">{formatPrice(totalCredit._sum.balance ?? 0)}</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/40">Points in Circulation</span>
            <Sparkles className="w-5 h-5 text-brand-400" />
          </div>
          <p className="text-2xl font-bold">
            {(totalPoints._sum.points ?? 0).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-2 glass rounded-2xl overflow-hidden">
          <form method="get" className="p-4 border-b border-white/5">
            <input
              name="q"
              defaultValue={q ?? ''}
              placeholder="Search customers by email or name..."
              className="w-full px-4 py-2 rounded-xl bg-dark-700 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </form>
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 text-left">
                <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Customer</th>
                <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Credit</th>
                <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Points</th>
                <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-white/30 text-sm">
                    No customers match.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-5 py-4">
                    <Link
                      href={`/admin/customers/${u.id}`}
                      className="text-sm font-medium hover:text-brand-400 transition-colors"
                    >
                      {u.name ?? 'Unnamed'}
                    </Link>
                    <p className="text-xs text-white/40">{u.email}</p>
                  </td>
                  <td className="px-5 py-4 text-sm font-bold text-emerald-400">
                    {formatPrice(u.storeCredit?.balance ?? 0)}
                  </td>
                  <td className="px-5 py-4 text-sm font-bold text-brand-400">
                    {(u.loyalty?.points ?? 0).toLocaleString()}
                  </td>
                  <td className="px-5 py-4">
                    {u.loyalty && <Badge variant="info">{u.loyalty.tier}</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Grant form */}
        <GrantCreditsForm />
      </div>
    </div>
  )
}
