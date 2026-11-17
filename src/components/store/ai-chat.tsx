'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageSquare, X, Send, Bot, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function AiChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm Vita, your AI guide at The Vitality Project. Ask me about our products, peptides, or anything else — I'm here to help.",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId] = useState(() => `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMessage: Message = { role: 'user', content: input.trim() }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage], sessionId }),
      })
      const data = await res.json()
      if (data.message) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.message }])
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I had trouble connecting. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 w-80 sm:w-96 z-50 flex flex-col glass rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/12" style={{ maxHeight: '520px' }}>
          <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-white/5 shrink-0">
            <div className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
              <Bot className="w-4 h-4 text-brand-400" />
            </div>
            <div>
              <p className="font-semibold text-sm">Vita AI</p>
              <p className="text-xs text-white/40">Powered by Claude</p>
            </div>
            <button onClick={() => setOpen(false)} className="ml-auto text-white/40 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-brand-500/20 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-3 h-3 text-brand-400" />
                  </div>
                )}
                <div className={cn(
                  'max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed',
                  msg.role === 'user' ? 'bg-brand-500 text-white rounded-tr-sm' : 'bg-dark-700 text-white/80 rounded-tl-sm'
                )}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-brand-500/20 flex items-center justify-center shrink-0">
                  <Bot className="w-3 h-3 text-brand-400" />
                </div>
                <div className="bg-dark-700 px-3 py-2 rounded-2xl rounded-tl-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-white/40" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-white/10 shrink-0">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Ask about our products..."
                rows={1}
                className="flex-1 px-3 py-2 rounded-xl bg-dark-700 border border-white/12 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center shrink-0 disabled:opacity-50 hover:bg-brand-600 transition-colors"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close chat' : 'Chat with Vita'}
        aria-expanded={open}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-brand-500 shadow-lg shadow-brand-500/30 flex items-center justify-center hover:bg-brand-600 transition-all hover:scale-105"
      >
        {open ? <X className="w-5 h-5 text-white" /> : <MessageSquare className="w-5 h-5 text-white" />}
      </button>
    </>
  )
}
