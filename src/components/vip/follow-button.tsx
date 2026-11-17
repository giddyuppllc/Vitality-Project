'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, UserCheck, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'

export function FollowButton({
  userId,
  name,
  initialFollowing,
  size = 'md',
  refresh = false,
}: {
  userId: string
  name: string
  initialFollowing: boolean
  size?: 'sm' | 'md'
  /** Re-render the server page after a change (profile stats). */
  refresh?: boolean
}) {
  const router = useRouter()
  const [following, setFollowing] = useState(initialFollowing)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/vip/members/${userId}/follow`, { method: following ? 'DELETE' : 'POST' }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    setBusy(false)
    if (!res?.ok) {
      setError(data?.error || 'Try again.')
      return
    }
    setFollowing(data.following)
    if (refresh) router.refresh()
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={following}
        aria-label={following ? `Unfollow ${name}` : `Follow ${name}`}
        className={cn(
          'vip-focus inline-flex items-center gap-1.5 rounded-xl font-semibold transition-colors disabled:opacity-60',
          size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
          following
            ? 'border border-white/20 text-white/85 hover:bg-white/[0.06]'
            : 'bg-brand-500 text-white hover:bg-brand-600',
        )}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : following ? (
          <UserCheck className="h-4 w-4" aria-hidden="true" />
        ) : (
          <UserPlus className="h-4 w-4" aria-hidden="true" />
        )}
        {following ? 'Following' : 'Follow'}
      </button>
      {error && <span role="alert" className="mt-1 text-xs text-red-300">{error}</span>}
    </span>
  )
}
