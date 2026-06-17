import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, tooManyRequests } from '@/lib/rate-limit'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `You are Vita, the AI assistant for The Vitality Project — a premium peptide and performance compound e-commerce platform.

Your role:
- Help customers find the right products for their goals
- Answer questions about peptides in an educational way
- Guide customers through ordering (Zelle or Wire Transfer)
- Handle general support questions

Important guidelines:
- Never make specific medical claims or dosage recommendations
- Always recommend consulting a healthcare professional for medical advice
- You can discuss general research and intended use at your own discretion
- Keep responses concise (2-4 sentences typically)
- If asked about order status, ask for their order number and email

Payment info: We accept Zelle and Wire Transfer. Payment details are provided after order placement.`

export async function POST(req: NextRequest) {
  // Strict per-IP rate limit — this route is intentionally unauthenticated
  // (anonymous storefront chat) and hits a paid LLM, so cap it tightly to
  // contain cost/DoS abuse. ~20 messages/minute is plenty for a real user.
  const limited = checkRateLimit(req, 'ai-chat', { limit: 20, windowMs: 60_000 })
  if (!limited.allowed) return tooManyRequests(limited.retryAfter)

  try {
    const { messages, sessionId } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // RAG: extract keywords from recent user messages and retrieve relevant products
    const recentUserText = messages
      .filter((m: any) => m.role === 'user')
      .slice(-3)
      .map((m: any) => String(m.content))
      .join(' ')
      .toLowerCase()

    // Tokenize to meaningful words (filter stopwords)
    const stopwords = new Set(['i', 'me', 'my', 'the', 'a', 'an', 'is', 'are', 'was', 'do', 'does', 'what', 'how', 'can', 'you', 'for', 'to', 'of', 'and', 'or', 'in', 'on', 'at', 'it', 'this', 'that', 'with', 'have', 'has', 'be', 'get', 'tell', 'me', 'about'])
    const keywords = [...new Set(recentUserText.split(/\W+/).filter((w) => w.length > 2 && !stopwords.has(w)))]

    // Retrieve products matching keywords in name, description, or tags
    const relevantProducts = keywords.length > 0
      ? await prisma.product.findMany({
          where: {
            status: 'ACTIVE',
            OR: [
              { name: { contains: keywords[0], mode: 'insensitive' } },
              { description: { contains: keywords[0], mode: 'insensitive' } },
              { tags: { hasSome: keywords.slice(0, 5) } },
              ...keywords.slice(1, 4).map((kw) => ({ name: { contains: kw, mode: 'insensitive' } as any })),
            ],
          },
          select: { name: true, shortDesc: true, description: true, price: true, slug: true, tags: true },
          take: 5,
        })
      : []

    // Fall back to featured products if no matches
    const contextProducts = relevantProducts.length > 0
      ? relevantProducts
      : await prisma.product.findMany({
          where: { status: 'ACTIVE', featured: true },
          select: { name: true, shortDesc: true, price: true, slug: true },
          take: 4,
        })

    const productContext = contextProducts.length > 0
      ? `\n\nRelevant products for this conversation:\n${contextProducts.map((p) =>
          `- **${p.name}** — ${p.shortDesc ?? 'Premium compound'} | $${(p.price / 100).toFixed(2)} | /products/${p.slug}`
        ).join('\n')}`
      : ''

    const fullSystem = `${SYSTEM_PROMPT}${productContext}`

    // Save user message to DB
    if (sessionId) {
      await prisma.chatSession.upsert({
        where: { sessionId },
        create: { sessionId },
        update: { updatedAt: new Date() },
      })
      const lastMsg = messages[messages.length - 1]
      if (lastMsg?.role === 'user') {
        await prisma.chatMessage.create({
          data: { sessionId, role: 'user', content: String(lastMsg.content) },
        })
      }
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: fullSystem,
      messages: messages.slice(-10).map((m: any) => ({
        role: m.role,
        content: String(m.content),
      })),
    })

    const assistantContent = response.content[0].type === 'text' ? response.content[0].text : ''

    // Save assistant reply
    if (sessionId && assistantContent) {
      await prisma.chatMessage.create({
        data: { sessionId, role: 'assistant', content: assistantContent },
      })
    }

    return NextResponse.json({ message: assistantContent })
  } catch (error) {
    console.error('AI chat error:', error)
    return NextResponse.json({ error: 'Chat unavailable' }, { status: 500 })
  }
}
