'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { addAffiliateManually, type AddAffiliateState } from './add-affiliate-action'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      disabled={pending}
      className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
    >
      {pending ? 'Adding…' : 'Add'}
    </button>
  )
}

export function AddAffiliateForm() {
  const [state, formAction] = useActionState<AddAffiliateState, FormData>(
    addAffiliateManually,
    null,
  )

  return (
    <form action={formAction} className="rounded-xl bg-dark-700 border border-white/10 p-4">
      <p className="text-sm font-medium mb-1">Add an affiliate</p>
      <p className="text-xs text-white/40 mb-3">
        Enter the email of an existing account — they&rsquo;re added as Active. No account yet?
        Send the invite link →
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          name="email"
          type="email"
          required
          placeholder="their@email.com"
          className="flex-1 min-w-[150px] px-3 py-2 rounded-lg bg-dark-800 border border-white/10 text-sm"
        />
        <input
          name="paypalEmail"
          type="email"
          placeholder="PayPal email (optional)"
          className="flex-1 min-w-[150px] px-3 py-2 rounded-lg bg-dark-800 border border-white/10 text-sm"
        />
        <SubmitButton />
      </div>
      {state && (
        <p
          className={`mt-2 text-xs ${state.ok ? 'text-emerald-400' : 'text-red-400'}`}
          role="status"
        >
          {state.message}
        </p>
      )}
    </form>
  )
}
