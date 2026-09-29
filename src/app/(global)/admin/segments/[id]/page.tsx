import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ArrowLeft } from 'lucide-react'
import { SegmentBuilder } from '@/components/admin/segment-builder'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditSegmentPage({ params }: Props) {
  const { id } = await params
  const segment = await prisma.savedSegment.findUnique({ where: { id } })
  if (!segment) notFound()

  const tags = await prisma.tag.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, color: true },
  })

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin/segments"
          className="text-white/40 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Edit segment</h1>
          <p className="text-white/40 text-sm mt-0.5">{segment.name}</p>
        </div>
      </div>
      <SegmentBuilder mode="edit" id={id} tags={tags} />
    </div>
  )
}
