'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Award, CheckCircle2, Loader2, RotateCcw, Sparkles, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Question {
  id: string
  prompt: string
  options: string[]
}

interface Result {
  correct: number
  total: number
  scorePct: number
  passPct: number
  passed: boolean
  pointsAwarded: number
  courseCompleted: boolean
  certificateCode: string | null
  results: Array<{ id: string; chosen: number | null; correct: boolean; correctIndex: number; correctOption: string | null; explanation: string | null }>
}

/**
 * A module check: one radio group per question. Answers are scored on the
 * server; the right answers and explanations appear only after submitting.
 * Retry starts a clean attempt.
 */
export function QuizForm({ quizId, questions, passPct, courseSlug }: { quizId: string; questions: Question[]; passPct: number; courseSlug: string }) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const top = useRef<HTMLDivElement>(null)
  const answered = Object.keys(answers).length
  const byId = new Map(result?.results.map((r) => [r.id, r]) ?? [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (answered < questions.length) {
      setError(`Answer every question first (${questions.length - answered} to go).`)
      return
    }
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/vip/quizzes/${quizId}/attempts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(d.error || 'That didn’t go through. Please try again.')
    setResult(d)
    router.refresh()
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    top.current?.focus()
  }

  function retry() {
    setAnswers({})
    setResult(null)
    setError(null)
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <div>
      <div ref={top} tabIndex={-1} className="scroll-mt-24 outline-none" aria-live="polite">
        {result && (
          <div
            className={cn('mb-5 rounded-2xl border p-5', result.passed ? 'border-emerald-300/40 bg-emerald-300/[0.07]' : 'border-amber-300/40 bg-amber-300/[0.07]')}
            data-testid="quiz-result"
          >
            <p className="flex items-center gap-2 text-lg font-bold">
              {result.passed ? <CheckCircle2 className="h-5 w-5 text-emerald-300" aria-hidden="true" /> : <XCircle className="h-5 w-5 text-amber-300" aria-hidden="true" />}
              {result.passed ? 'Passed' : 'Not quite'} — {result.scorePct}%
            </p>
            <p className="mt-1 text-sm text-white/75">
              {result.correct} of {result.total} correct. The pass mark is {result.passPct}%.
              {result.passed ? '' : ' Review the explanations below, then try again.'}
            </p>
            {(result.pointsAwarded > 0 || result.certificateCode) && (
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#ead7a8]">
                {result.pointsAwarded > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="h-4 w-4" aria-hidden="true" /> +{result.pointsAwarded.toLocaleString('en-US')} points
                  </span>
                )}
                {result.courseCompleted && result.certificateCode && (
                  <Link href={`/certificate/${result.certificateCode}`} className="vip-focus inline-flex items-center gap-1 rounded font-semibold underline underline-offset-2">
                    <Award className="h-4 w-4" aria-hidden="true" /> Course complete — open your certificate
                  </Link>
                )}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {!result.passed && (
                <button type="button" onClick={retry} className="vip-focus inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600">
                  <RotateCcw className="h-4 w-4" aria-hidden="true" /> Try again
                </button>
              )}
              <Link href={`/classroom/${courseSlug}`} className="vip-focus inline-flex min-h-[44px] items-center rounded-xl border border-white/15 px-4 text-sm font-semibold hover:bg-white/[0.06]">
                Back to the course
              </Link>
              {result.passed && (
                <button type="button" onClick={retry} className="vip-focus inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm text-white/70 hover:bg-white/[0.06]">
                  <RotateCcw className="h-4 w-4" aria-hidden="true" /> Take it again
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={submit} className="space-y-4" aria-label="Module check">
        {questions.map((q, qi) => {
          const r = byId.get(q.id)
          return (
            <fieldset key={q.id} className="vip-surface p-5" disabled={!!result}>
              <legend className="sr-only">Question {qi + 1}</legend>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/60" aria-hidden="true">
                Question {qi + 1} of {questions.length}
              </p>
              <p className="mt-1 font-semibold leading-snug">{q.prompt}</p>
              <div className="mt-3 space-y-2">
                {q.options.map((o, oi) => {
                  const chosen = answers[q.id] === oi
                  const isRight = r && r.correctIndex === oi
                  const isWrongPick = r && r.chosen === oi && !r.correct
                  return (
                    <label
                      key={oi}
                      className={cn(
                        'flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#4aa3f7]',
                        isRight
                          ? 'border-emerald-300/50 bg-emerald-300/10'
                          : isWrongPick
                            ? 'border-red-300/50 bg-red-300/10'
                            : chosen
                              ? 'border-brand-400/60 bg-brand-500/15'
                              : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]',
                        result && 'cursor-default',
                      )}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        value={oi}
                        checked={chosen}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                        className="h-4 w-4 shrink-0 accent-[#1d6fd6]"
                      />
                      <span className="flex-1">{o}</span>
                      {isRight && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" aria-label="Correct answer" />}
                      {isWrongPick && <XCircle className="h-4 w-4 shrink-0 text-red-300" aria-label="Your answer, incorrect" />}
                    </label>
                  )
                })}
              </div>
              {r?.explanation && <p className="mt-3 rounded-xl bg-white/[0.04] p-3 text-sm leading-relaxed text-white/80">{r.explanation}</p>}
            </fieldset>
          )
        })}
        {!result && (
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={busy} className="vip-focus inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Submit answers
            </button>
            <span className="text-sm text-white/60">
              {answered}/{questions.length} answered · pass mark {passPct}%
            </span>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-200">
            {error}
          </p>
        )}
      </form>
    </div>
  )
}
