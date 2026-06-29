import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ArrowRight, Shield, Zap, Lock, Package, FlaskConical, Dna, Brain, Sparkles, Star } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { ProductCard } from '@/components/store/product-card'

async function getFeaturedProducts() {
  return prisma.product.findMany({
    where: { featured: true, status: 'ACTIVE' },
    include: {
      images: { orderBy: { position: 'asc' }, take: 1 },
      category: { select: { name: true, slug: true } },
      variants: true,
    },
    take: 4,
    orderBy: { createdAt: 'desc' },
  })
}

const features = [
  { icon: Shield, title: 'Private Infrastructure', desc: 'Dedicated servers. No third-party cloud dependencies.', href: '/about' },
  { icon: Lock, title: 'Data Sovereignty', desc: 'Full ownership of your data, transactions, and records.', href: '/privacy' },
  { icon: Zap, title: 'Lab Tested', desc: 'Third-party verified. 98%+ purity. CoA on request.', href: '/peptides-safety' },
  { icon: Package, title: 'Discreet Shipping', desc: 'Plain packaging. No branding on exterior.', href: '/shipping' },
]

const categories = [
  { icon: Zap, title: 'Repair & Recovery', desc: 'Tissue repair, gut health, connective tissue research', href: '/products?category=repair-recovery', image: '/images/lifestyle/outdoor-performance.png' },
  { icon: Dna, title: 'Body Composition', desc: 'GH secretagogues, metabolic optimization research', href: '/products?category=body-composition', image: '/images/lifestyle/active-lifestyle.png' },
  { icon: Sparkles, title: 'Longevity & Aesthetics', desc: 'Skin biology, collagen, cellular longevity research', href: '/products?category=longevity-aesthetics', image: '/images/lifestyle/recovery-routine.png' },
  { icon: Brain, title: 'Neuro & Mood', desc: 'Anxiolytic, nootropic, cognitive research', href: '/products?category=neuro-mood', image: '/images/lifestyle/focus-discipline.png' },
]

export default async function HomePage() {
  const featured = await getFeaturedProducts()

  return (
    <>
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex items-center overflow-hidden">
        {/* Full-bleed hero image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/lifestyle/hero-athlete-sunrise.png"
            alt="Active lifestyle"
            fill
            className="object-cover object-center"
            priority
          />
          {/* Gradient overlay — lets the image breathe while keeping text readable */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0e1a] via-transparent to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 w-full">
          <div className="glass p-10 sm:p-14 max-w-2xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] mb-6 tracking-tight">
              Elevate Your{' '}
              <span className="text-gradient">Vitality</span>
            </h1>
            <p className="text-lg text-white/70 mb-4 leading-relaxed max-w-lg">
              Research-grade peptides. Lab-verified purity. Private infrastructure. Built for people who take their biology seriously.
            </p>
            <p className="text-sm text-brand-300/80 mb-8">
              Members get first access + exclusive pricing.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/membership">
                <Button size="lg">
                  <Sparkles className="w-5 h-5" />
                  Join The Membership
                </Button>
              </Link>
              <Link href="/products">
                <Button size="lg" variant="secondary">
                  Browse Catalog
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ────────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f) => (
              <Link key={f.title} href={f.href}>
                <div className="glass rounded-2xl p-5 card-hover h-full">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mb-3">
                    <f.icon className="w-5 h-5 text-brand-400" />
                  </div>
                  <h3 className="font-semibold text-white text-sm mb-1">{f.title}</h3>
                  <p className="text-xs text-white/40 leading-relaxed">{f.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── LIFESTYLE SPLIT — image + glass text ─────────────────────── */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden">
              <Image
                src="/images/lifestyle/wellness-morning.png"
                alt="Morning routine"
                fill
                className="object-cover"
              />
            </div>
            <div className="glass p-8 sm:p-10 rounded-3xl">
              <FlaskConical className="w-8 h-8 text-brand-400 mb-4" />
              <h2 className="text-3xl font-bold mb-4">Built for Serious Researchers</h2>
              <p className="text-white/60 leading-relaxed mb-6">
                Every compound in our catalog is sourced from verified synthesis labs, tested independently for purity, and shipped on private infrastructure with zero third-party data exposure. No middlemen. No gray market. No compromises.
              </p>
              <Link href="/about">
                <Button variant="secondary">
                  Our Standards <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── SHOP BY CATEGORY ─────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Shop by Research Area</h2>
            <p className="text-white/40">Curated categories for focused study</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {categories.map((cat) => (
              <Link key={cat.title} href={cat.href}>
                <div className="glass rounded-2xl overflow-hidden card-hover group cursor-pointer h-full">
                  <div className="relative aspect-[3/2] overflow-hidden">
                    <Image
                      src={cat.image}
                      alt={cat.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-3 left-3">
                      <div className="w-8 h-8 rounded-lg bg-brand-500/20 backdrop-blur-sm border border-brand-500/30 flex items-center justify-center">
                        <cat.icon className="w-4 h-4 text-brand-300" />
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-white text-sm mb-1">{cat.title}</h3>
                    <p className="text-xs text-white/40 leading-relaxed">{cat.desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED PRODUCTS ────────────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-10">
              <div>
                <h2 className="text-3xl font-bold mb-2">Featured Compounds</h2>
                <p className="text-white/40">Our most popular research peptides</p>
              </div>
              <Link href="/products" className="text-brand-400 hover:text-brand-300 text-sm flex items-center gap-1">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product as any} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── LAB IMAGE BREAK ──────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl overflow-hidden aspect-[21/9]">
            <Image
              src="/images/lifestyle/lab-quality.png"
              alt="Pharmaceutical grade vials"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
            <div className="absolute inset-0 flex items-center">
              <div className="px-8 sm:px-12 max-w-lg">
                <p className="text-xs text-brand-300 uppercase tracking-widest mb-2">Quality Guarantee</p>
                <h2 className="text-3xl sm:text-4xl font-bold mb-3">98%+ Purity Standard</h2>
                <p className="text-white/60 text-sm leading-relaxed mb-4">
                  Every vial is third-party tested. Certificate of Analysis available on request. No exceptions.
                </p>
                <Link href="/peptides-safety">
                  <Button variant="secondary" size="sm">
                    Our Standards <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MEMBERSHIP CTA ─────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="glass p-12 sm:p-16 rounded-3xl text-center">
            <Sparkles className="w-10 h-10 text-brand-400 mx-auto mb-4" />
            <h2 className="text-4xl font-bold mb-4">Vitalize Your Project</h2>
            <p className="text-white/50 mb-3 max-w-md mx-auto leading-relaxed">
              Pay less. Get more. Every month. Members get early access, exclusive pricing, and compounds you won't find anywhere else.
            </p>
            <p className="text-sm text-brand-300/60 mb-8">Pay by Zelle — your membership activates as soon as funds clear.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/membership">
                <Button size="lg">
                  <Sparkles className="w-5 h-5" />
                  Join The Membership
                </Button>
              </Link>
              <Link href="/affiliate">
                <Button size="lg" variant="outline">Become an Affiliate</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
