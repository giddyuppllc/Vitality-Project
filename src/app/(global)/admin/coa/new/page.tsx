import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CoaUploadForm } from '@/components/admin/coa-upload-form'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CoaNewPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/auth/login')

  // Pull product list for autocomplete suggestions
  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE' },
    select: { name: true, slug: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div>
      <Link
        href="/admin/coa"
        className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to CoA library
      </Link>

      <h1 className="text-2xl font-bold mb-1">Upload Certificate of Analysis</h1>
      <p className="text-white/40 mb-8 text-sm">
        Attach a PDF or paste an external URL. Each upload is preserved as a new record — full history per peptide is kept.
      </p>

      <CoaUploadForm products={products} />
    </div>
  )
}
