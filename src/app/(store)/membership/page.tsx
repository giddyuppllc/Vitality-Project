'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Sparkles, Check, Zap, Shield, Package, Star, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const plans = [
  {
    id: 'club',
    name: 'The Club',
    price: '$25',
    period: '/mo',
    savings: null,
    desc: 'Like Costco for peptides — base membership',
    features: [
      '5% permanent discount on every order',
      'First access to new product drops',
      'Members-only monthly discount drops',
      'Members-only newsletter',
      'Priority support',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    price: '$150',
    period: '/mo',
    savings: 'Save more',
    desc: 'Subscription box — peptides delivered with perks',
    popular: true,
    features: [
      'Everything in The Club',
      '10% permanent discount',
      '1 free peptide coupon every month',
      'BAC water + syringes included',
      'Free sample list — first picks of new releases',
      'Access to newest research compounds',
      'Peptide care package each shipment',
    ],
  },
  {
    id: 'premium',
    name: 'Premium Stacks',
    price: '$250',
    period: '/mo',
    savings: 'Best value',
    desc: 'White-glove tier — everything you need, no friction',
    features: [
      'Everything in Plus',
      '15% permanent discount',
      '3 free peptides every month',
      'BAC water + syringes free with every order',
      'We roll the red tape — concierge service',
      'Exclusive premium-only stacks',
      'Direct line to the team',
    ],
  },
]

const perks = [
  { icon: Zap, title: 'Member Pricing', desc: 'Up to 25% off every single order, every month. The more you commit, the more you save.' },
  { icon: Package, title: 'Free Shipping', desc: 'Every membership tier includes free shipping. Quarterly and annual members get expedited.' },
  { icon: Shield, title: 'First Access', desc: 'New compounds and stacks drop to members first. The public waits. You don\'t.' },
  { icon: Star, title: 'Member-Only Products', desc: 'Exclusive formulations and stack configurations only available to active members.' },
]

const PLAN_TO_TIER: Record<string, 'CLUB' | 'PLUS' | 'PREMIUM'> = {
  club: 'CLUB',
  plus: 'PLUS',
  premium: 'PREMIUM',
}

export default function MembershipPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-16 text-white/40">Loading…</div>}>
      <MembershipPageInner />
    </Suspense>
  )
}

function MembershipPageInner() {
  const router = useRouter()
  const params = useSearchParams()
  const { data: session, status } = useSession()
  const initialTier = (params.get('tier') ?? 'plus').toLowerCase()
  const [selectedPlan, setSelectedPlan] = useState(
    initialTier in PLAN_TO_TIER ? initialTier : 'plus',
  )
  const [submitted, setSubmitted] = useState<{ orderNumber: string; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleJoin = async () => {
    setError('')
    if (status === 'loading') return

    // Not signed in — bounce to register, return here after with the tier preserved.
    if (!session?.user) {
      const next = encodeURIComponent(`/membership?tier=${selectedPlan}&autostart=1`)
      router.push(`/auth/register?next=${next}`)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/membership/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: PLAN_TO_TIER[selectedPlan] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not start membership')
      setSubmitted({
        orderNumber: data.orderNumber ?? '—',
        total: data.total ?? 0,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // Auto-start subscribe after registration round-trip (?autostart=1)
  useEffect(() => {
    if (params.get('autostart') === '1' && session?.user && !submitted && !loading) {
      handleJoin()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user, params])

  if (submitted) {
    const planLabel = plans.find((p) => p.id === selectedPlan)?.name ?? 'Membership'
    const amount = `$${(submitted.total / 100).toFixed(2)}`
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="glass rounded-3xl p-12">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Invoice sent.</h1>
          <p className="text-white/70 mb-4 leading-relaxed">
            Your <strong className="text-white">{planLabel}</strong> membership invoice
            is on its way to your inbox. Send <strong className="text-white">{amount}</strong> via Zelle
            with memo <strong className="text-white">{submitted.orderNumber}</strong> and we'll activate
            you the moment funds clear (usually same day).
          </p>
          <p className="text-white/40 text-sm mb-8">
            Check your email for the Zelle send-to details. If you don't see it within a few minutes, look in spam.
          </p>
          <Link href="/products">
            <Button variant="secondary">
              Browse the Catalog <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Header */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 glass-subtle rounded-full px-4 py-1.5 text-sm text-brand-300 mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          Memberships — Live now
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold mb-4 leading-tight">
          Vitalize Your <span className="text-gradient">Project</span>
        </h1>
        <p className="text-xl text-white/50 max-w-2xl mx-auto leading-relaxed mb-6">
          Pay less. Get more. Every month. Members unlock exclusive discounts, priority access to new products, and benefits you won't find anywhere else.
        </p>
        <div className="glass-subtle rounded-2xl p-5 max-w-xl mx-auto">
          <h3 className="font-semibold text-white mb-3 text-sm uppercase tracking-wider">What's included</h3>
          <div className="grid grid-cols-2 gap-3 text-sm text-white/60">
            <div className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-400 shrink-0" /> Up to 25% off every order</div>
            <div className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-400 shrink-0" /> Free shipping on all orders</div>
            <div className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-400 shrink-0" /> Member-only products</div>
            <div className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-400 shrink-0" /> Early access to new drops</div>
            <div className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-400 shrink-0" /> Exclusive stacks & bundles</div>
            <div className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-400 shrink-0" /> Priority customer support</div>
          </div>
        </div>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-20">
        {plans.map((plan) => (
          <button
            key={plan.id}
            onClick={() => setSelectedPlan(plan.id)}
            className={`glass rounded-2xl p-6 text-left transition-all relative ${
              selectedPlan === plan.id
                ? 'border-brand-400/50 ring-1 ring-brand-400/30'
                : ''
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                Most Popular
              </div>
            )}
            {plan.savings && (
              <span className="text-xs text-emerald-400 font-medium">{plan.savings}</span>
            )}
            <h3 className="text-xl font-bold mt-1">{plan.name}</h3>
            <div className="flex items-baseline gap-1 mt-2 mb-2">
              <span className="text-3xl font-bold text-white">{plan.price}</span>
              <span className="text-white/40 text-sm">{plan.period}</span>
            </div>
            <p className="text-sm text-white/40 mb-4">{plan.desc}</p>
            <ul className="space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-white/60">
                  <Check className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-5">
              <div className={`w-full py-2 rounded-xl text-center text-sm font-medium transition-all ${
                selectedPlan === plan.id
                  ? 'bg-brand-500 text-white'
                  : 'bg-white/5 text-white/40'
              }`}>
                {selectedPlan === plan.id ? 'Selected' : 'Select Plan'}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Signup CTA */}
      <div className="max-w-lg mx-auto mb-20">
        <div className="glass rounded-3xl p-8">
          <h2 className="text-2xl font-bold text-center mb-2">Join now</h2>
          <p className="text-center text-white/40 text-sm mb-6">
            {session?.user
              ? "You're signed in — pick a plan above and tap join. We'll email Zelle instructions and activate you the moment funds clear."
              : "Choose a plan above, then create an account (30 seconds) and we'll email Zelle instructions to activate your membership."}
          </p>

          {error && (
            <div className="glass rounded-xl p-3 mb-4 border border-red-500/30">
              <p className="text-sm text-red-400 text-center">{error}</p>
            </div>
          )}

          <Button onClick={handleJoin} size="lg" loading={loading} className="w-full">
            <Sparkles className="w-5 h-5" />
            Join as {plans.find(p => p.id === selectedPlan)?.name} Member
          </Button>
          <p className="text-xs text-white/25 text-center mt-4">
            Pay via Zelle. Membership activates as soon as funds clear.
          </p>
        </div>
      </div>

      {/* Perks Grid */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold text-center mb-8">What Members Get</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {perks.map((perk) => (
            <div key={perk.title} className="glass rounded-2xl p-6">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mb-3">
                <perk.icon className="w-5 h-5 text-brand-400" />
              </div>
              <h3 className="font-semibold text-white mb-1">{perk.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{perk.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="glass rounded-3xl p-10 text-center">
        <h2 className="text-2xl font-bold mb-3">Pick your plan and join in 60 seconds.</h2>
        <p className="text-white/40 mb-6 max-w-md mx-auto">
          Discounts on every order. Free bac water + syringes on Plus. 1–3 free peptides each cycle on Plus / Premium. Cancel anytime.
        </p>
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <Button size="lg">
            <Sparkles className="w-5 h-5" />
            Choose a plan
          </Button>
        </button>
      </div>

      {/* Membership terms & rules */}
      <div className="mt-12 rounded-2xl border border-white/10 bg-dark-800/40 p-6 text-xs leading-relaxed text-white/45">
        <h2 className="text-sm font-semibold text-white/70 mb-3">Membership terms &amp; rules</h2>
        <ul className="space-y-2 list-disc pl-4">
          <li>
            <strong className="text-white/70">Billing.</strong> Memberships are billed monthly via
            Zelle. Your membership activates once payment is confirmed (usually same day) and renews
            every 30 days. We email an invoice each cycle with the Zelle send-to details and a memo
            to include with your payment.
          </li>
          <li>
            <strong className="text-white/70">Member discount.</strong> Your tier discount (Club 5%,
            Plus 10%, Premium 15%) applies automatically to every order while your membership is
            active.
          </li>
          <li>
            <strong className="text-white/70">Free peptide credits.</strong> Plus includes 1 free
            peptide credit per paid cycle; Premium includes 3. A credit makes any single peptide free
            at checkout (excludes stacks, supplies, and sample packs). Credits are use-it-or-lose-it —
            they reset at each renewal, do not roll over, and have no cash value.
          </li>
          <li>
            <strong className="text-white/70">Free supplies.</strong> Plus and Premium members get
            free bacteriostatic water + syringes auto-added to every order.
          </li>
          <li>
            <strong className="text-white/70">Free shipping.</strong> Plus and Premium include free US
            priority shipping.
          </li>
          <li>
            <strong className="text-white/70">Cancellation.</strong> Cancel anytime from your account.
            Your benefits and any unused credits remain active through the end of the paid cycle;
            payments already made are final and non-refundable.
          </li>
          <li>
            <strong className="text-white/70">Shipping.</strong> Orders ship within the United States
            only.
          </li>
        </ul>
        <p className="mt-4 text-white/35">
          Research use only. All products are sold strictly for laboratory and research purposes and
          are not for human or veterinary use, consumption, or for the diagnosis, treatment, cure, or
          prevention of any condition. Nothing on this page is medical advice.
        </p>
      </div>
    </div>
  )
}
