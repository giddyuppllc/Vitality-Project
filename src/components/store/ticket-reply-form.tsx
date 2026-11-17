'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/support/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(typeof d.error === 'string' ? d.error : 'Failed to send')
      } else {
        setBody('')
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="glass rounded-2xl p-5">
      <label htmlFor="reply-textarea-1" className="text-sm font-medium text-white/70 mb-2 block">
        Reply
      </label>
      <textarea
              id="reply-textarea-1"
        rows={5}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Type your reply…"
        className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none mb-3"
      />
      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
      <Button type="submit" loading={loading} size="sm">
        Send Reply
      </Button>
    </form>
  )
}
