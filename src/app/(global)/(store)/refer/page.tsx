import Link from 'next/link'
import { Gift, Users, DollarSign, Sparkles } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Refer a Friend — Give $10, Get $10',
  description:
    'Refer friends to The Vitality Project. You both get $10 in store credit when they make their first purchase.',
}

export default function ReferPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-16">
        <span className="inline-block text-xs font-medium uppercase tracking-[0.28em] text-brand-400 mb-4">
          Referral Program
        </span>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Give <span className="text-brand-400">$10</span>, Get <span className="text-brand-400">$10</span>
        </h1>
        <p className="text-white/60 text-lg max-w-2xl mx-auto leading-relaxed">
          Share The Vitality Project with a friend. When they make their first purchase,
          you both get $10 in store credit — stackable with member pricing.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-16">
        {[
          {
            icon: Users,
            title: '1. Share your link',
            body: 'Log in and grab your unique referral link from the affiliate dashboard.',
          },
          {
            icon: Gift,
            title: '2. They order',
            body: 'Your friend uses your link, shops, and checks out normally.',
          },
          {
            icon: DollarSign,
            title: '3. Both get paid',
            body: '$10 store credit lands in both accounts once their order ships.',
          },
        ].map((step) => (
          <div key={step.title} className="glass rounded-2xl p-6">
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-400/30 flex items-center justify-center mb-4">
              <step.icon className="w-5 h-5 text-brand-400" />
            </div>
            <h3 className="font-semibold text-white mb-2">{step.title}</h3>
            <p className="text-white/50 text-sm leading-relaxed">{step.body}</p>
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl p-8 md:p-10 text-center">
        <Sparkles className="w-8 h-8 text-brand-400 mx-auto mb-4" />
        <h2 className="text-2xl md:text-3xl font-bold mb-3">Ready to get started?</h2>
        <p className="text-white/60 mb-6 max-w-xl mx-auto">
          Our referral program is powered by the same platform as our affiliate program.
          Join in seconds and start sharing.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/affiliate"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium transition-colors"
          >
            Get my referral link
          </Link>
          <Link
            href="/products"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 font-medium transition-colors"
          >
            Browse the catalog
          </Link>
        </div>
      </div>

      <div className="mt-10 text-center">
        <p className="text-xs text-white/30 max-w-2xl mx-auto leading-relaxed">
          Credit is applied after the referred order is paid and shipped. One credit per
          referred customer. Store credit cannot be redeemed for cash.
        </p>
      </div>
    </div>
  )
}
