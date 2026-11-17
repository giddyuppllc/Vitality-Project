'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Star } from 'lucide-react'

export function ReviewForm({
  productId,
  productSlug,
}: {
  productId: string
  productSlug: string
}) {
  const router = useRouter()
  const [rating, setRating] = useState(5)
  const [hover, setHover] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, rating, title, body }),
      })
      const d = await res.json()
      if (!res.ok) {
        setError(typeof d.error === 'string' ? d.error : 'Failed to submit')
      } else {
        setSent(true)
        setTimeout(() => router.push(`/products/${productSlug}`), 1500)
      }
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <h2 className="text-xl font-bold mb-3">Thanks for your review</h2>
        <p className="text-white/50">
          It will appear publicly once approved by our team.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="glass rounded-2xl p-6 space-y-5">
      <div>
        <label className="text-sm font-medium text-white/70 mb-2 block">
          Rating
        </label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className="p-1"
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
            >
              <Star
                className={`w-7 h-7 transition-colors ${
                  n <= (hover || rating)
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-white/20'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Brief headline for your review"
        maxLength={120}
      />

      <div>
        <label htmlFor="review-textarea-1" className="text-sm font-medium text-white/70 mb-1.5 block">
          Review
        </label>
        <textarea
              id="review-textarea-1"
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          placeholder="Share your experience…"
          className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <Button type="submit" loading={loading} size="lg">
        Submit Review
      </Button>
    </form>
  )
}
