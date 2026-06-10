'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ShoppingCart, User, Menu, X, ChevronDown, Search } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { useSession, signOut } from 'next-auth/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SearchBar } from '@/components/store/search-bar'

const shopCategories = [
  { href: '/products', label: 'All Products' },
  { href: '/products?category=stacks', label: 'Stacks' },
  { href: '/products?category=repair-recovery', label: 'Repair & Recovery' },
  { href: '/products?category=body-composition', label: 'Body Composition' },
  { href: '/products?category=longevity-aesthetics', label: 'Longevity & Aesthetics' },
  { href: '/products?category=neuro-mood', label: 'Neuro & Mood' },
]

const learnLinks = [
  { href: '/what-are-peptides', label: 'The Biological Blueprint' },
  { href: '/how-peptides-work', label: 'How Peptides Work' },
  { href: '/peptides-benefits', label: 'Research Applications' },
  { href: '/peptides-safety', label: 'Safety & Quality' },
  { href: '/peptides-legality', label: 'Legality' },
]

export function Navbar() {
  const { itemCount } = useCart()
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <nav className="fixed top-0 w-full z-50 glass-elevated border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 md:h-44">

          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0">
            <Image
              src="/logo-edited.png"
              alt="The Vitality Project"
              width={900}
              height={900}
              className="h-16 md:h-40 w-auto object-contain"
              style={{ filter: 'invert(1) hue-rotate(180deg) brightness(1.15)' }}
              priority
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {/* Shop dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-1 text-sm text-white/60 hover:text-white transition-colors py-2">
                Shop <ChevronDown className="w-3.5 h-3.5 mt-0.5" />
              </button>
              <div className="absolute left-0 top-full pt-2 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-150">
                <div className="glass rounded-xl py-1.5 w-52 shadow-xl">
                  {shopCategories.map((cat) => (
                    <Link
                      key={cat.href}
                      href={cat.href}
                      className={`block px-4 py-2 text-sm transition-colors hover:bg-white/5 ${
                        cat.label === 'All Products'
                          ? 'text-white font-medium border-b border-white/10 mb-1'
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Learn dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-1 text-sm text-white/60 hover:text-white transition-colors py-2">
                Learn <ChevronDown className="w-3.5 h-3.5 mt-0.5" />
              </button>
              <div className="absolute left-0 top-full pt-2 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-150">
                <div className="glass rounded-xl py-1.5 w-56 shadow-xl">
                  {learnLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block px-4 py-2 text-sm text-white/60 hover:text-white transition-colors hover:bg-white/5"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <Link
              href="/membership"
              className="text-sm text-brand-300 hover:text-brand-200 transition-colors font-medium flex items-center gap-1.5"
            >
              Membership
              <span className="text-[9px] uppercase tracking-wider bg-brand-500/20 border border-brand-500/30 text-brand-300 px-1.5 py-0.5 rounded-full font-semibold">
                Soon
              </span>
            </Link>

            <Link
              href="/blog"
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              Blog
            </Link>

            <Link
              href="/about"
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              About
            </Link>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className="p-2 text-white/60 hover:text-white transition-colors"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Cart */}
            <Link href="/cart" className="relative p-2 text-white/60 hover:text-white transition-colors">
              <ShoppingCart className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand-500 rounded-full text-xs flex items-center justify-center text-white font-bold">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </Link>

            {/* Account */}
            {session ? (
              <div className="relative group">
                <button className="flex items-center gap-2 p-2 text-white/60 hover:text-white transition-colors">
                  <User className="w-5 h-5" />
                </button>
                <div className="absolute right-0 top-full mt-2 w-48 glass rounded-xl p-2 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all">
                  <Link href="/account" className="block px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg">My Account</Link>
                  <Link href="/account/orders" className="block px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg">Orders</Link>
                  {session.user.role === 'ADMIN' && (
                    <Link href="/admin" className="block px-3 py-2 text-sm text-brand-400 hover:text-brand-300 hover:bg-white/5 rounded-lg">Admin Panel</Link>
                  )}
                  <button
                    onClick={() => signOut()}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 rounded-lg"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <Link href="/auth/login">
                <Button size="sm" variant="outline">Sign In</Button>
              </Link>
            )}

            {/* Mobile toggle */}
            <button
              className="md:hidden p-2 text-white/60 hover:text-white"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Search drawer */}
      {searchOpen && (
        <div className="border-t border-white/10 bg-dark-900/70 backdrop-blur px-4 py-3">
          <div className="max-w-2xl mx-auto">
            <SearchBar autoFocus variant="full" onClose={() => setSearchOpen(false)} />
          </div>
        </div>
      )}

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 px-4 py-4 space-y-1">
          <p className="text-xs font-medium text-white/30 uppercase tracking-wider px-3 pb-1">Shop</p>
          {shopCategories.map((cat) => (
            <Link
              key={cat.href}
              href={cat.href}
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 text-white/70 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            >
              {cat.label}
            </Link>
          ))}
          <div className="border-t border-white/10 pt-2 mt-2" />
          <p className="text-xs font-medium text-white/30 uppercase tracking-wider px-3 pb-1">Learn</p>
          {learnLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 text-white/70 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            >
              {link.label}
            </Link>
          ))}
          <div className="border-t border-white/10 pt-2 mt-2" />
          <Link
            href="/membership"
            onClick={() => setMobileOpen(false)}
            className="px-3 py-2 text-brand-300 font-medium hover:text-brand-200 transition-colors rounded-lg hover:bg-white/5 flex items-center gap-2"
          >
            Membership
            <span className="text-[9px] uppercase tracking-wider bg-brand-500/20 border border-brand-500/30 text-brand-300 px-1.5 py-0.5 rounded-full font-semibold">
              Soon
            </span>
          </Link>
          <Link
            href="/blog"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2 text-white/70 hover:text-white transition-colors rounded-lg hover:bg-white/5"
          >
            Blog
          </Link>
          <Link
            href="/about"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2 text-white/70 hover:text-white transition-colors rounded-lg hover:bg-white/5"
          >
            About
          </Link>
        </div>
      )}
    </nav>
  )
}
