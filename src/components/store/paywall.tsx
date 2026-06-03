'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Check,
  Beaker,
  LogIn,
  UserPlus,
} from 'lucide-react'

/*
 * Paywall — opaque frosted overlay with a metallic Halo-inspired ring
 * frame around a slide carousel. Energy pulses radiate outward from
 * the ring through the surrounding Cortana vein mesh.
 *
 * — Full-screen opaque backdrop (site NOT visible behind)
 * — Upright ring frame (no perspective tilt — face-on)
 * — Metallic gradient stroke + holographic shimmer
 * — Concentric pulses explode outward from the ring perimeter
 * — Vein network canvas fills the rest of the screen
 */

const SLIDES = [
  {
    id: 'hero',
    headline: 'Be A Vital Member',
    subhead: 'Unlock Your Next Project',
    body:
      'Premium research compounds. Lab-verified purity. Member pricing. Built for people who take their biology seriously.',
    badge: 'WELCOME',
  },
  {
    id: 'club',
    headline: 'The Club',
    subhead: '$25/mo • Research Bundle Base',
    body:
      'Like Costco for research compounds. 5% permanent discount, first access to every drop, monthly members-only deals.',
    badge: 'TIER 01',
    bullets: [
      '5% permanent discount on every order',
      'First access to new product drops',
      'Members-only monthly discount drops',
      'Members-only newsletter',
    ],
  },
  {
    id: 'plus',
    headline: 'Plus',
    subhead: '$150/mo • Research Bundle Vital Product',
    body:
      'Subscription box with a complete care package every month. 10% discount, one free compound credit, BAC water + syringes included.',
    badge: 'TIER 02',
    popular: true,
    bullets: [
      '10% permanent discount',
      '1 free compound credit every month',
      'BAC water + syringes included',
      'Free sample list — first picks of new releases',
      'Access to newest research compounds',
    ],
  },
  {
    id: 'premium',
    headline: 'Premium Stacks',
    subhead: '$250/mo • Research Bundle Vital Product Plus More',
    body:
      'White-glove tier. 15% off everything, three free compounds every month, BAC water and syringes free with every order. We roll the red tape.',
    badge: 'TIER 03',
    bullets: [
      '15% permanent discount',
      '3 free compounds every month',
      'BAC water + syringes free with every order',
      'Concierge service — direct line to the team',
      'Exclusive premium-only stacks',
    ],
  },
  {
    id: 'supplies',
    headline: 'Research Supplies',
    subhead: 'BAC Water · Syringes · Alcohol Pads',
    body:
      'Reconstitute and research always in sterile environments. Members get supplies bundled. Non-members can purchase à la carte at any tier.',
    badge: 'SUPPLIES',
    bullets: [
      'Bacteriostatic water (30mL multi-dose vials)',
      'Sterile insulin syringes — 30G, 0.5mL',
      'Alcohol prep pads — sterile, 200ct',
      'Reconstitution kits available',
    ],
  },
  {
    id: 'free',
    headline: 'Or Start Free',
    subhead: 'BAC Water + Syringe Pack — Free On First Order',
    body:
      'No commitment. Make an account, place your first order, receive bacteriostatic water and a syringe pack on us. Membership is optional.',
    badge: 'FREE TIER',
    bullets: [
      'Free BAC water (30mL) on first order',
      'Free syringe 5-pack on first order',
      'No subscription required',
      'Upgrade to membership any time',
    ],
  },
  {
    id: 'partner',
    headline: 'Become A Partner',
    subhead: 'Gyms · Clinics · Doctor Offices · Wellness Practices',
    body:
      'Host a Vitality kiosk at your location. Your clients shop, you earn commission on every order. Custom pricing plans, white-glove onboarding, no inventory required.',
    badge: 'FOR PARTNERS',
    bullets: [
      'Earn commission on every sale through your location',
      'Free iPad kiosk setup — sits in your office, ready to shop',
      'Custom pricing plans for your client base',
      'No inventory — direct shipping handled for you',
      'Real-time dashboard for sales, commissions, payouts',
    ],
  },
] as const

const PAYWALL_DISMISS_KEY = 'vp_paywall_dismissed_v1'

const HIDDEN_PREFIXES = [
  '/admin',
  '/business',
  '/auth',
  '/kiosk',
  '/api',
  '/k/',
  '/account',
  '/_next',
  // The membership signup page IS the paywall's primary call-to-action
  // ("Become A Vital Member" → /membership). Logged-out visitors must be
  // able to reach it to pick a tier and start the Zelle signup flow, so it
  // must never be re-covered by the paywall overlay.
  '/membership',
]

export function Paywall() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [active, setActive] = useState(0)
  // Start visible by default — block site rendering on first paint.
  // Hidden routes & logged-in users get cleared in the effect below.
  const isHiddenRoute = pathname ? HIDDEN_PREFIXES.some((p) => pathname.startsWith(p)) : false
  const [visible, setVisible] = useState(!isHiddenRoute)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    if (HIDDEN_PREFIXES.some((p) => pathname?.startsWith(p))) {
      setVisible(false)
      return
    }
    if (status === 'loading') return // hold default visible while checking
    if (session?.user) {
      setVisible(false)
      return
    }
    // Hard paywall — only sign-in / sign-up gets you through
    setVisible(true)
  }, [pathname, session, status])

  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setActive((a) => Math.min(a + 1, SLIDES.length - 1))
      if (e.key === 'ArrowLeft') setActive((a) => Math.max(a - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible])

  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [visible])

  // ── Canvas: vein network + outward pulses from ring ──────────────────
  useEffect(() => {
    if (!visible) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const resize = () => {
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
    }
    resize()
    window.addEventListener('resize', resize)

    // Cortana blue — matches main site vein network exactly
    const R = 120, G = 160, B = 255

    // Ring radius in pixels relative to viewport
    const ringRadius = () => Math.min(window.innerWidth, window.innerHeight) * 0.32

    // Build dense node grid for visible vein mesh
    const buildNodes = () => {
      const nodes: { x: number; y: number; pulse: number }[] = []
      const spacing = 30
      const cols = Math.ceil(window.innerWidth / spacing) + 2
      const rows = Math.ceil(window.innerHeight / spacing) + 2
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const jx = Math.sin(r * 13.7 + c * 7.1) * spacing * 0.4
          const jy = Math.cos(r * 9.3 + c * 11.5) * spacing * 0.4
          nodes.push({
            x: c * spacing + jx - spacing,
            y: r * spacing + jy - spacing,
            pulse: 0,
          })
        }
      }
      return nodes
    }
    let nodes = buildNodes()
    const onResize = () => { resize(); nodes = buildNodes() }
    window.removeEventListener('resize', resize)
    window.addEventListener('resize', onResize)

    let lastTime = 0
    const startTime = performance.now()

    const draw = (time: number) => {
      if (!canvas || !ctx) return
      const dt = Math.min((time - (lastTime || time)) / 1000, 0.05)
      lastTime = time
      const t = (time - startTime) / 1000
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      const ringR = ringRadius()

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(dpr, dpr)

      // ── Inject pulses outward from ring — slow, fluid, varied ──
      // Slower durations for languid, breath-like motion
      const pulses = [
        { duration: 11.0, offset: 0,    intensity: 0.45, bandWidth: 180 },
        { duration: 14.5, offset: 3.6,  intensity: 0.35, bandWidth: 150 },
        { duration: 9.5,  offset: 7.2,  intensity: 0.40, bandWidth: 130 },
        { duration: 12.5, offset: 10.0, intensity: 0.30, bandWidth: 200 },
      ]

      const maxR = Math.max(window.innerWidth, window.innerHeight) * 0.95

      for (const p of pulses) {
        const phase = ((t + p.offset) % p.duration) / p.duration
        // Ease-out quintic — long, languid expansion
        const eased = 1 - Math.pow(1 - phase, 5)
        const pulseR = ringR + eased * maxR
        // Bell-curve envelope — soft fade in, soft fade out
        // Uses sine wave shaped to peak around 25% phase
        const envelope = phase < 0.25
          ? Math.sin((phase / 0.25) * Math.PI / 2)         // ease-in 0→1
          : Math.pow(1 - (phase - 0.25) / 0.75, 2.2)        // smooth fade-out
        const intensity = p.intensity * envelope

        if (intensity < 0.01) continue

        // Stamp pulse energy on nodes within a band of pulseR
        for (const n of nodes) {
          const dx = n.x - cx
          const dy = n.y - cy
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < ringR) continue
          const ringDist = Math.abs(d - pulseR)
          if (ringDist < p.bandWidth) {
            // Smooth quintic falloff for soft band edges
            const s = 1 - ringDist / p.bandWidth
            const smooth = s * s * s
            n.pulse = Math.min(1, n.pulse + smooth * intensity * dt * 9)
          }
        }
      }

      // Decay — very slow for fluid lingering glow
      for (const n of nodes) n.pulse *= 0.982

      // Ambient breathing
      const breathe = 0.7 + 0.22 * Math.sin(t * 0.6) + 0.10 * Math.sin(t * 1.3)

      // ── Draw mesh edges — visible vein network with diagonals ──
      ctx.lineCap = 'round'
      const cols = Math.ceil(window.innerWidth / 30) + 2
      const skipR = ringR - 20

      const drawEdge = (a: typeof nodes[0], b: typeof nodes[0]) => {
        const dab = Math.hypot(b.x - cx, b.y - cy)
        if (dab < skipR) return
        const avgPulse = (a.pulse + b.pulse) * 0.5
        const alpha = 0.18 * breathe + avgPulse * 0.85
        if (alpha < 0.02) return
        ctx.strokeStyle = `rgba(${R}, ${G}, ${B}, ${alpha})`
        ctx.lineWidth = 0.5 + avgPulse * 1.2
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        const da = Math.hypot(a.x - cx, a.y - cy)
        if (da < skipR) continue

        // right neighbor
        const right = nodes[i + 1]
        if (right && (i + 1) % cols !== 0) drawEdge(a, right)

        // down neighbor
        const down = nodes[i + cols]
        if (down) drawEdge(a, down)

        // down-right diagonal (alternating for organic mesh)
        if ((i % 2 === 0)) {
          const dr = nodes[i + cols + 1]
          if (dr && (i + 1) % cols !== 0) drawEdge(a, dr)
        }

        // down-left diagonal (other alternation)
        if ((i % 3 === 0)) {
          const dl = nodes[i + cols - 1]
          if (dl && i % cols !== 0) drawEdge(a, dl)
        }
      }

      // Bright pulse nodes
      for (const n of nodes) {
        if (n.pulse < 0.06) continue
        const r = 0.4 + n.pulse * 1.8
        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${R}, ${G}, ${B}, ${Math.min(n.pulse * 0.7, 0.7)})`
        ctx.fill()

        if (n.pulse > 0.2) {
          const gr = 4 + n.pulse * 14
          const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, gr)
          grad.addColorStop(0, `rgba(${R}, ${G}, ${B}, ${n.pulse * 0.3})`)
          grad.addColorStop(1, `rgba(${R}, ${G}, ${B}, 0)`)
          ctx.beginPath()
          ctx.arc(n.x, n.y, gr, 0, Math.PI * 2)
          ctx.fillStyle = grad
          ctx.fill()
        }
      }

      // ── Outward expanding shockwave rings — slow, fluid, layered ──
      const shockwaves = [
        { duration: 11.0, offset: 0    },
        { duration: 14.5, offset: 3.6  },
        { duration: 9.5,  offset: 7.2  },
        { duration: 12.5, offset: 10.0 },
      ]

      for (const s of shockwaves) {
        const phase = ((t + s.offset) % s.duration) / s.duration
        const eased = 1 - Math.pow(1 - phase, 5)
        const pulseR = ringR + eased * maxR
        // Bell-curve fade
        const envelope = phase < 0.2
          ? Math.sin((phase / 0.2) * Math.PI / 2)
          : Math.pow(1 - (phase - 0.2) / 0.8, 2.4)
        const alpha = envelope * 0.32

        if (alpha < 0.005) continue

        // Soft icy outer halo (white-cyan)
        ctx.beginPath()
        ctx.arc(cx, cy, pulseR, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(190, 220, 255, ${alpha * 0.25})`
        ctx.lineWidth = 24 - eased * 14
        ctx.stroke()

        // Mid glow halo
        ctx.beginPath()
        ctx.arc(cx, cy, pulseR, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${R}, ${G}, ${B}, ${alpha * 0.5})`
        ctx.lineWidth = 14 - eased * 8
        ctx.stroke()

        // Sharp core line — Cortana blue
        ctx.beginPath()
        ctx.arc(cx, cy, pulseR, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${R}, ${G}, ${B}, ${alpha})`
        ctx.lineWidth = 2 - eased * 1
        ctx.stroke()
      }

      ctx.restore()
      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', onResize)
    }
  }, [visible])

  const next = () => setActive((a) => Math.min(a + 1, SLIDES.length - 1))
  const prev = () => setActive((a) => Math.max(a - 1, 0))

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStart.current.x
    const dy = t.clientY - touchStart.current.y
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next()
      else prev()
    }
    touchStart.current = null
  }

  if (!visible) return null

  const slide = SLIDES[active]

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Fully opaque ICY backdrop — glacial blues, cyan undertones */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 50% 35%, rgba(140, 200, 240, 0.18) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 50% 50%, #0e1e3a 0%, #061029 50%, #020714 100%)
          `,
        }}
      />

      {/* Icy mist veil — subtle aurora bands */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 50% 40% at 30% 20%, rgba(120, 200, 255, 0.12) 0%, transparent 70%),
            radial-gradient(ellipse 60% 50% at 70% 80%, rgba(160, 220, 255, 0.10) 0%, transparent 70%),
            radial-gradient(ellipse 40% 30% at 80% 30%, rgba(200, 230, 255, 0.06) 0%, transparent 70%)
          `,
        }}
      />

      {/* Vein network + pulse canvas — fills entire screen */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
      />

      {/* Top brand mark */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-brand-300/80 z-10">
        <Sparkles className="w-3 h-3" />
        The Vitality Project
      </div>


      {/* ────── METALLIC HALO RING — UPRIGHT FRAME ────── */}
      <div
        className="relative flex items-center justify-center"
        style={{
          width: 'min(92vw, 720px)',
          height: 'min(92vw, 720px)',
          maxHeight: '92vh',
        }}
      >
        {/* HALO RINGWORLD — structural ring with inner surface, plating, atmospheric haze */}
        <svg
          viewBox="0 0 800 800"
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{
            transform: 'perspective(1400px) rotateX(18deg)',
            transformOrigin: 'center center',
          }}
        >
          <defs>
            {/* Outer hull — chrome metal */}
            <linearGradient id="hullOuter" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1a2440" />
              <stop offset="20%" stopColor="#5a6a98" />
              <stop offset="50%" stopColor="#c0ccea" />
              <stop offset="80%" stopColor="#5a6a98" />
              <stop offset="100%" stopColor="#0e1428" />
            </linearGradient>

            {/* Inner band — atmospheric/landscape glow (like Halo's inner surface) */}
            <radialGradient id="innerSurface" cx="50%" cy="50%" r="55%">
              <stop offset="80%" stopColor="rgba(120, 160, 255, 0)" />
              <stop offset="92%" stopColor="rgba(160, 200, 255, 0.25)" />
              <stop offset="98%" stopColor="rgba(200, 220, 255, 0.55)" />
              <stop offset="100%" stopColor="rgba(240, 248, 255, 0.7)" />
            </radialGradient>

            {/* Hull edges — bright metallic */}
            <linearGradient id="edgeBright" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(220, 232, 255, 0)" />
              <stop offset="50%" stopColor="rgba(240, 248, 255, 1)" />
              <stop offset="100%" stopColor="rgba(220, 232, 255, 0)" />
            </linearGradient>

            <filter id="ringGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" />
            </filter>

            <filter id="atmosphereBlur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" />
            </filter>

            {/* Mask exposing only the ring band (between r=318 and r=388) */}
            <mask id="bandMask">
              <rect width="800" height="800" fill="black" />
              <circle cx="400" cy="400" r="388" fill="white" />
              <circle cx="400" cy="400" r="318" fill="black" />
            </mask>
          </defs>

          {/* ── Outer ambient halo glow — atmosphere bleeding off the hull ── */}
          <circle
            cx="400" cy="400" r="402"
            fill="none"
            stroke="rgba(120, 160, 255, 0.35)"
            strokeWidth="3"
            filter="url(#atmosphereBlur)"
          >
            <animate attributeName="opacity" values="0.5;0.95;0.5" dur="6s" repeatCount="indefinite" />
          </circle>

          {/* ── HULL: thick metallic band ── */}
          {/* Outer hull surface */}
          <circle
            cx="400" cy="400" r="388"
            fill="none"
            stroke="url(#hullOuter)"
            strokeWidth="12"
          />

          {/* Inner surface — radial gradient creates the "inner ringworld" face glow */}
          <circle cx="400" cy="400" r="388" fill="url(#innerSurface)" mask="url(#bandMask)" />

          {/* ── STRUCTURAL PLATING — segmented mechanical panels around the inside ── */}
          <g opacity="0.85" mask="url(#bandMask)">
            {Array.from({ length: 32 }).map((_, i) => {
              const angle = (i / 32) * Math.PI * 2
              const next = ((i + 1) / 32) * Math.PI * 2
              const r1 = 322
              const r2 = 384
              // Build a quad polygon for each segment edge
              const x1a = 400 + Math.cos(angle) * r1
              const y1a = 400 + Math.sin(angle) * r1
              const x2a = 400 + Math.cos(angle) * r2
              const y2a = 400 + Math.sin(angle) * r2
              const x1b = 400 + Math.cos(next) * r1
              const y1b = 400 + Math.sin(next) * r1
              return (
                <line
                  key={`seg-${i}`}
                  x1={x1a} y1={y1a} x2={x2a} y2={y2a}
                  stroke="rgba(40, 55, 90, 0.7)"
                  strokeWidth="1"
                />
              )
            })}
          </g>

          {/* Tick / connector lines on outer rim (mechanical detail) */}
          <g opacity="0.7">
            {Array.from({ length: 64 }).map((_, i) => {
              const angle = (i / 64) * Math.PI * 2
              const isMajor = i % 8 === 0
              const r1 = 388
              const r2 = isMajor ? 398 : 393
              const x1 = 400 + Math.cos(angle) * r1
              const y1 = 400 + Math.sin(angle) * r1
              const x2 = 400 + Math.cos(angle) * r2
              const y2 = 400 + Math.sin(angle) * r2
              return (
                <line
                  key={`tick-${i}`}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={isMajor ? 'rgba(220, 232, 255, 0.85)' : 'rgba(160, 180, 220, 0.4)'}
                  strokeWidth={isMajor ? 1.4 : 0.4}
                />
              )
            })}
          </g>

          {/* ── EDGES — bright outer + inner highlights (gives the band thickness) ── */}
          <circle cx="400" cy="400" r="394" fill="none" stroke="rgba(240, 248, 255, 0.9)" strokeWidth="0.8" />
          <circle cx="400" cy="400" r="382" fill="none" stroke="rgba(180, 200, 240, 0.6)" strokeWidth="0.4" />
          <circle cx="400" cy="400" r="320" fill="none" stroke="rgba(220, 230, 255, 0.85)" strokeWidth="0.8" />
          <circle cx="400" cy="400" r="316" fill="none" stroke="rgba(150, 180, 230, 0.4)" strokeWidth="0.4" />

          {/* ── ENERGY CONDUITS — light running along the inner band ── */}
          <circle
            cx="400" cy="400" r="354"
            fill="none"
            stroke="rgba(140, 180, 255, 0.5)"
            strokeWidth="0.8"
            strokeDasharray="3 18"
          >
            <animateTransform attributeName="transform" type="rotate" from="0 400 400" to="360 400 400" dur="60s" repeatCount="indefinite" />
          </circle>

          {/* ── ROTATING SCAN BEAM — bright arc traveling around the hull ── */}
          <circle
            cx="400" cy="400" r="388"
            fill="none"
            stroke="rgba(255, 255, 255, 0.95)"
            strokeWidth="4"
            strokeDasharray="60 2378"
            strokeLinecap="round"
            filter="url(#ringGlow)"
          >
            <animateTransform attributeName="transform" type="rotate" from="0 400 400" to="360 400 400" dur="10s" repeatCount="indefinite" />
          </circle>

          {/* Counter-rotating soft arc on inner edge */}
          <circle
            cx="400" cy="400" r="320"
            fill="none"
            stroke="rgba(180, 210, 255, 0.7)"
            strokeWidth="2"
            strokeDasharray="100 1910"
            strokeLinecap="round"
            opacity="0.8"
          >
            <animateTransform attributeName="transform" type="rotate" from="360 400 400" to="0 400 400" dur="18s" repeatCount="indefinite" />
          </circle>
        </svg>

        {/* Slide content INSIDE the ring */}
        <div
          className="relative flex items-center justify-center w-full h-full"
          style={{ padding: '14% 12%' }}
        >
          <div className="w-full max-w-[440px] mx-auto">
            <div className="text-center mb-3">
              <span className="inline-block text-[10px] uppercase tracking-[0.5em] text-brand-300/80 font-semibold">
                {slide.badge}
              </span>
            </div>

            <div key={slide.id} className="paywall-slide-enter text-center">
              <h1 className="text-3xl sm:text-4xl font-bold leading-[1.05] mb-2 tracking-tight">
                {slide.headline}
              </h1>
              <p className="text-sm text-brand-300/90 mb-4 font-medium">
                {slide.subhead}
              </p>
              <p className="text-xs sm:text-sm text-white/65 leading-relaxed mb-5 max-w-md mx-auto">
                {slide.body}
              </p>

              {'bullets' in slide && slide.bullets && (
                <ul className="text-left text-xs sm:text-sm text-white/75 space-y-1.5 mb-5 max-w-xs mx-auto">
                  {slide.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-brand-300 shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}

              {slide.id === 'hero' && (
                <div className="flex flex-col gap-2 max-w-xs mx-auto">
                  <Link
                    href="/membership"
                    className="bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-colors flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" /> Become A Vital Member
                  </Link>
                  <Link
                    href="/auth/login"
                    className="border border-white/15 hover:bg-white/5 text-white/80 text-sm font-medium rounded-xl px-5 py-2.5 transition-colors flex items-center justify-center gap-2"
                  >
                    <LogIn className="w-4 h-4" /> Sign In
                  </Link>
                </div>
              )}

              {(slide.id === 'club' || slide.id === 'plus' || slide.id === 'premium') && (
                <Link
                  href={`/membership?tier=${slide.id}`}
                  className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-colors"
                >
                  <Sparkles className="w-4 h-4" /> Join {slide.headline}
                </Link>
              )}

              {slide.id === 'supplies' && (
                <Link
                  href="/auth/register"
                  className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-colors"
                >
                  <Beaker className="w-4 h-4" /> Browse Research Supplies
                </Link>
              )}

              {slide.id === 'free' && (
                <Link
                  href="/auth/register"
                  className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-colors"
                >
                  <Beaker className="w-4 h-4" /> Claim Free BAC Water
                </Link>
              )}

              {slide.id === 'partner' && (
                <div className="flex flex-col gap-2 max-w-xs mx-auto">
                  <Link
                    href="/business/apply"
                    className="bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-colors flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" /> Apply To Partner
                  </Link>
                  <p className="text-[11px] text-white/30 text-center">
                    Approved partners get a free kiosk setup
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Carousel controls — outside the ring */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-6 z-10">
        <button
          onClick={prev}
          disabled={active === 0}
          className="p-2 text-white/60 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-2">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActive(i)}
              className={`transition-all rounded-full ${
                i === active
                  ? 'w-6 h-1.5 bg-brand-300'
                  : 'w-1.5 h-1.5 bg-white/25 hover:bg-white/50'
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>

        <button
          onClick={next}
          disabled={active === SLIDES.length - 1}
          className="p-2 text-white/60 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          aria-label="Next"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom prompt — sign in or join */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-white/40 uppercase tracking-widest z-10 flex items-center gap-3">
        <span>Sign in or join to enter</span>
        <span className="w-1 h-1 rounded-full bg-brand-400 animate-pulse" />
      </div>

      <style>{`
        @keyframes paywall-slide-fade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .paywall-slide-enter {
          animation: paywall-slide-fade 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  )
}
