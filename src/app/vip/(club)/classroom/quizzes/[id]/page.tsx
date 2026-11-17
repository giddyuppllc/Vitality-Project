import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CheckCircle2, ClipboardList, Lock } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { getQuizForMember } from '@/lib/vip/classroom'
import { QuizForm } from '@/components/vip/quiz-form'
import { Pill } from '@/components/vip/academy-ui'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Module check' }

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireVipPage('member')
  const { id } = await params
  const quiz = await getQuizForMember(id, viewer.userId, viewer.accessTier, { isAdmin: viewer.isAdmin })
  if (!quiz) notFound()
  const best = quiz.attempts.reduce((m, a) => Math.max(m, a.scorePct), 0)

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/classroom/${quiz.course.slug}`} className="vip-focus mb-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg text-sm text-white/65 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {quiz.course.title}
      </Link>
      <header className="vip-surface-strong mb-5 p-5 sm:p-6">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/60">
          <ClipboardList className="h-4 w-4 text-brand-300" aria-hidden="true" /> Module check · {quiz.moduleTitle}
        </p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight">{quiz.title}</h1>
        {quiz.intro && <p className="mt-2 text-white/70">{quiz.intro}</p>}
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Pill>{quiz.questions.length || '—'} questions</Pill>
          <Pill>Pass mark {quiz.passPct}%</Pill>
          {quiz.passed ? (
            <Pill tone="green">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Passed · best {best}%
            </Pill>
          ) : quiz.attempts.length > 0 ? (
            <Pill tone="amber">Best so far {best}%</Pill>
          ) : null}
        </div>
      </header>

      {quiz.allowed ? (
        <QuizForm quizId={quiz.id} questions={quiz.questions} passPct={quiz.passPct} courseSlug={quiz.course.slug} />
      ) : (
        <div className="vip-surface flex items-center gap-3 p-5 text-sm text-white/75">
          <Lock className="h-4 w-4" aria-hidden="true" /> This module check opens with the course.
          <Link href={`/classroom/${quiz.course.slug}`} className="font-semibold text-brand-300 hover:text-brand-200">
            See the course →
          </Link>
        </div>
      )}
    </div>
  )
}
