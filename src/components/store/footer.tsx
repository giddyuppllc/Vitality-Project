import Link from 'next/link'
import Image from 'next/image'
import { NewsletterSignup } from './newsletter-signup'

export function Footer() {
  return (
    <footer className="border-t border-white/10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Newsletter band */}
        <div className="glass rounded-2xl p-6 md:p-8 mb-12 flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-1">Stay in the loop</h3>
            <p className="text-white/50 text-sm max-w-md">
              Research updates, product drops, and members-only perks. No spam — unsubscribe anytime.
            </p>
          </div>
          <div className="md:w-96">
            <NewsletterSignup source="footer" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <Image src="/logo-light.png" alt="The Vitality Project" width={160} height={160} className="h-12 w-auto object-contain mb-3" />
            <p className="text-white/40 text-sm max-w-xs">
              Premium quality research compounds sourced and fulfilled with complete data privacy.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-white/80 mb-3 text-sm">Shop</h4>
            <ul className="space-y-2 text-sm text-white/55">
              <li><Link href="/products" className="hover:text-white transition-colors">All Products</Link></li>
              <li><Link href="/stacks" className="hover:text-white transition-colors">Stacks</Link></li>
              <li><Link href="/products?category=repair-recovery" className="hover:text-white transition-colors">Repair & Recovery</Link></li>
              <li><Link href="/products?category=body-composition" className="hover:text-white transition-colors">Body Composition</Link></li>
              <li><Link href="/products?category=longevity-aesthetics" className="hover:text-white transition-colors">Longevity & Aesthetics</Link></li>
              <li><Link href="/products?category=neuro-mood" className="hover:text-white transition-colors">Neuro & Mood</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white/80 mb-3 text-sm">Learn</h4>
            <ul className="space-y-2 text-sm text-white/55">
              <li><Link href="/what-are-peptides" className="hover:text-white transition-colors">What Are Peptides</Link></li>
              <li><Link href="/how-peptides-work" className="hover:text-white transition-colors">How They Work</Link></li>
              <li><Link href="/peptides-safety" className="hover:text-white transition-colors">Safety & Quality</Link></li>
              <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white/80 mb-3 text-sm">Company</h4>
            <ul className="space-y-2 text-sm text-white/55">
              <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
              <li><Link href="/research" className="hover:text-white transition-colors">Research</Link></li>
              <li><Link href="/coa" className="hover:text-white transition-colors">Certificates of Analysis</Link></li>
              <li><Link href="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              <li><Link href="/shipping" className="hover:text-white transition-colors">Shipping Policy</Link></li>
              <li><Link href="/affiliate" className="hover:text-white transition-colors">Affiliates</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        {/* RUO Legal Block */}
        <div className="mt-8 pt-8 border-t border-white/10">
          <div className="glass rounded-xl p-5 mb-6">
            <p className="text-white/50 text-xs leading-relaxed">
              <strong className="text-white/50">Research Use Only Disclaimer:</strong> All products sold by The Vitality Project are intended strictly for in vitro laboratory research and scientific study. They are not intended for human or animal consumption, diagnostic use, or therapeutic application. These products have not been evaluated by the Food and Drug Administration (FDA) and are not approved to diagnose, treat, cure, or prevent any disease or medical condition. By purchasing from this site you confirm you are a qualified researcher and agree to our{' '}
              <Link href="/terms" className="text-brand-400 hover:text-brand-300">Terms of Service</Link>.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-white/45 text-xs">© {new Date().getFullYear()} The Vitality Project. All rights reserved.</p>
            <p className="text-white/45 text-xs">Private infrastructure. No third-party data sharing.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
