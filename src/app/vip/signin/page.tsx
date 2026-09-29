import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getVipViewer } from '@/lib/vip/access'
import { GLOBAL_LINKS, globalUrl } from '@/lib/vip/links'
import { Wordmark } from '@/components/vip/ui'
import { VIP_COPY } from '@/lib/vip/copy'
import { SignInForm } from '@/components/vip/signin-form'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Sign in' }

const ERRORS: Record<string, string> = {
  sso_invalid: 'That sign-in link has expired or is not valid. Sign in below, or open the clubhouse again from vitalityproject.global.',
  sso_used: 'That sign-in link was already used. Sign in below, or open the clubhouse again from vitalityproject.global.',
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const viewer = await getVipViewer()
  if (viewer?.isMember) redirect('/feed')
  const { error } = await searchParams

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="vip-focus mb-8 self-start rounded-xl">
        <Wordmark />
      </Link>
      <div className="vip-surface-strong p-6 sm:p-7">
        <h1 className="text-xl font-bold">{VIP_COPY.signin.title}</h1>
        <p className="mt-1 text-sm leading-relaxed text-white/60">{VIP_COPY.signin.body}</p>
        {error && ERRORS[error] && (
          <p role="alert" className="mt-4 rounded-lg border border-amber-200/30 bg-amber-200/[0.06] px-3 py-2 text-sm text-amber-50">
            {ERRORS[error]}
          </p>
        )}
        <SignInForm />
        <div className="mt-5 space-y-2 border-t border-white/[0.07] pt-4 text-sm">
          <a href={globalUrl('/clubhouse')} className="vip-focus block text-brand-300 hover:text-brand-200">
            Already signed in at vitalityproject.global? Continue from there →
          </a>
          <a href={GLOBAL_LINKS.resetPassword()} className="vip-focus block text-white/55 hover:text-white">
            Forgot password
          </a>
          <Link href="/#levels" className="vip-focus block text-white/55 hover:text-white">
            {VIP_COPY.signin.newHere} {VIP_COPY.signin.newHereLink} →
          </Link>
        </div>
      </div>
    </div>
  )
}
