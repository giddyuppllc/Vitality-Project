'use client'

import { localInputToIso } from '@/lib/datetime-local'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  DollarSign,
  Sparkles,
  CheckSquare,
  UserCog,
  X,
  Zap,
} from 'lucide-react'

interface Props {
  userId: string
  userEmail: string
}

export function CustomerQuickActions({ userId, userEmail }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState<null | 'credit' | 'points' | 'task'>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // credit form
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  // task form
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [taskPriority, setTaskPriority] = useState<
    'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  >('NORMAL')
  const [taskDueAt, setTaskDueAt] = useState('')

  const reset = () => {
    setOpen(null)
    setAmount('')
    setReason('')
    setTaskTitle('')
    setTaskDesc('')
    setTaskPriority('NORMAL')
    setTaskDueAt('')
    setError('')
  }

  const grant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!open) return
    const numeric = Number(amount)
    if (!numeric || numeric < 1) {
      setError('Enter a positive amount')
      return
    }
    if (!reason.trim()) {
      setError('Reason is required')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/credits/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          kind: open === 'credit' ? 'credit' : 'points',
          amount:
            open === 'credit' ? Math.round(numeric * 100) : Math.round(numeric),
          reason: reason.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed')
        return
      }
      reset()
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskTitle.trim()) {
      setError('Title required')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle.trim(),
          description: taskDesc.trim() || undefined,
          priority: taskPriority,
          dueAt: localInputToIso(taskDueAt) ?? undefined,
          entityType: 'User',
          entityId: userId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed')
        return
      }
      reset()
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-brand-400" /> Quick actions
      </h3>
      <div className="space-y-2">
        <ActionBtn
          onClick={() => setOpen('credit')}
          icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
          label="Grant store credit"
        />
        <ActionBtn
          onClick={() => setOpen('points')}
          icon={<Sparkles className="w-4 h-4 text-brand-400" />}
          label="Grant loyalty points"
        />
        <ActionBtn
          onClick={() => setOpen('task')}
          icon={<CheckSquare className="w-4 h-4 text-purple-400" />}
          label="Create task"
        />
        <Link
          href={`/admin/customers/${userId}?tab=notes`}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition-colors"
        >
          <UserCog className="w-4 h-4 text-amber-400" />
          <span>Add note</span>
        </Link>
      </div>

      {open && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={reset}
        >
          <div
            className="glass rounded-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">
                {open === 'credit'
                  ? 'Grant store credit'
                  : open === 'points'
                    ? 'Grant loyalty points'
                    : 'Create task'}
              </h3>
              <button
                type="button"
                onClick={reset}
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(open === 'credit' || open === 'points') && (
              <form onSubmit={grant} className="space-y-3">
                <div>
                  <label className="text-xs text-white/50 block mb-1">
                    {open === 'credit' ? 'Amount (USD)' : 'Points'}
                  </label>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    type="number"
                    step={open === 'credit' ? '0.01' : '1'}
                    min="1"
                    placeholder={open === 'credit' ? '25.00' : '500'}
                    className="w-full px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1">
                    Reason
                  </label>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Goodwill after shipping delay"
                    className="w-full px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                {error && (
                  <p className="text-xs text-red-400">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium disabled:opacity-40"
                >
                  {busy ? 'Granting…' : 'Grant'}
                </button>
              </form>
            )}

            {open === 'task' && (
              <form onSubmit={createTask} className="space-y-3">
                <div>
                  <label className="text-xs text-white/50 block mb-1">
                    Title
                  </label>
                  <input
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="e.g. Follow up on return request"
                    className="w-full px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1">
                    Description
                  </label>
                  <textarea
                    value={taskDesc}
                    onChange={(e) => setTaskDesc(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-white/50 block mb-1">
                      Priority
                    </label>
                    <select
                      value={taskPriority}
                      onChange={(e) =>
                        setTaskPriority(e.target.value as typeof taskPriority)
                      }
                      className="w-full px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/50 block mb-1">
                      Due
                    </label>
                    <input
                      type="datetime-local"
                      value={taskDueAt}
                      onChange={(e) => setTaskDueAt(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium disabled:opacity-40"
                >
                  {busy ? 'Creating…' : 'Create task'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ActionBtn({
  onClick,
  icon,
  label,
}: {
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition-colors text-left"
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
