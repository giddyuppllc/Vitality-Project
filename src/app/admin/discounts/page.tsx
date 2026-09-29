import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatDate, formatPrice } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, Edit } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminDiscountsPage() {
  const codes = await prisma.discountCode.findMany({
    include: { rule: true },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Discount Codes</h1>
          <p className="text-white/40 mt-1">{codes.length} codes</p>
        </div>
        <Link href="/admin/discounts/new">
          <Button>
            <Plus className="w-4 h-4" /> New Coupon
          </Button>
        </Link>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left">
              {[
                'Code',
                'Type',
                'Value',
                'Min Order',
                'Uses',
                'Expires',
                'Rules',
                'Status',
                '',
              ].map((h) => (
                <th
                  key={h}
                  className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {codes.map((code) => (
              <tr key={code.id} className="hover:bg-white/2 transition-colors">
                <td className="px-5 py-4">
                  <code className="text-brand-400 font-mono font-bold text-sm">
                    {code.code}
                  </code>
                </td>
                <td className="px-5 py-4 text-sm text-white/60">{code.type}</td>
                <td className="px-5 py-4 text-sm font-medium">
                  {code.type === 'PERCENTAGE'
                    ? `${code.value}%`
                    : code.type === 'FREE_SHIPPING'
                    ? 'Free ship'
                    : code.type === 'BOGO'
                    ? 'BOGO'
                    : formatPrice(code.value)}
                </td>
                <td className="px-5 py-4 text-sm text-white/60">
                  {code.minOrder ? formatPrice(code.minOrder) : '—'}
                </td>
                <td className="px-5 py-4 text-sm text-white/60">
                  {code.usedCount}
                  {code.maxUses ? ` / ${code.maxUses}` : ''}
                </td>
                <td className="px-5 py-4 text-sm text-white/60">
                  {code.expiresAt ? formatDate(code.expiresAt) : 'Never'}
                </td>
                <td className="px-5 py-4">
                  {code.rule ? (
                    <Badge variant="info">Advanced</Badge>
                  ) : (
                    <span className="text-white/30 text-xs">—</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <Badge variant={code.active ? 'success' : 'default'}>
                    {code.active ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="px-5 py-4">
                  <Link
                    href={`/admin/discounts/${code.id}`}
                    className="p-1.5 text-white/30 hover:text-brand-400 transition-colors inline-flex"
                  >
                    <Edit className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            ))}
            {codes.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-5 py-16 text-center text-white/30 text-sm"
                >
                  No discount codes yet.{' '}
                  <Link href="/admin/discounts/new" className="text-brand-400">
                    Create one
                  </Link>
                  .
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
