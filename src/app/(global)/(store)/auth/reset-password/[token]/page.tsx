import { ResetPasswordForm } from './reset-form'
import { KeyRound, Sparkles } from 'lucide-react'

export default async function ResetPasswordTokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ invite?: string; org?: string }>
}) {
  const { token } = await params
  const { invite, org } = await searchParams
  const isInvite = invite === '1'

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-dark-900">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto mb-4">
            {isInvite ? (
              <Sparkles className="w-6 h-6 text-brand-400" />
            ) : (
              <KeyRound className="w-6 h-6 text-brand-400" />
            )}
          </div>
          {isInvite ? (
            <>
              <h1 className="text-2xl font-bold">Welcome{org ? ` to ${org}` : ''}</h1>
              <p className="text-white/40 mt-1">
                Set your password to activate your account.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Set a new password</h1>
              <p className="text-white/40 mt-1">
                Choose a strong password you haven&apos;t used before.
              </p>
            </>
          )}
        </div>

        <div className="glass rounded-2xl p-8">
          <ResetPasswordForm token={token} isInvite={isInvite} />
        </div>
      </div>
    </div>
  )
}
