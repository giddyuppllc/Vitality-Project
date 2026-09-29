import { ImageResponse } from 'next/og'

// The store's app/opengraph-image.tsx sits at the app root (its URL must not
// change for vitalityproject.global), so it would otherwise be inherited by
// clubhouse pages. This file overrides it for the vip segment: the VP
// monogram and the clubhouse name in the clubhouse palette — no store or
// product wording. (Pages stay noindex; this only dresses shared links.)
export const alt = 'The Vitality Project Clubhouse'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function VipOpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#070b14',
          backgroundImage: 'radial-gradient(circle at 15% 0%, rgba(29,111,214,0.35), rgba(7,11,20,0) 55%)',
          padding: '80px 96px',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        <svg width="220" height="220" viewBox="0 0 64 64">
          <rect x="1" y="1" width="62" height="62" rx="16" fill="#0b1322" stroke="#82c3ff" strokeOpacity="0.35" strokeWidth="1.5" />
          <path d="M13 19 L23.5 45 L34 19" fill="none" stroke="#ffffff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M38 45 V19 H44.5 a7.5 7.5 0 0 1 0 15 H38" fill="none" stroke="#d4b26a" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 64 }}>
          <div style={{ fontSize: 26, letterSpacing: '0.3em', color: '#82c3ff', fontWeight: 700, textTransform: 'uppercase' }}>
            The Vitality Project
          </div>
          <div style={{ marginTop: 12, fontSize: 104, fontWeight: 800, letterSpacing: '-0.03em' }}>Clubhouse</div>
          <div style={{ marginTop: 12, fontSize: 34, color: '#d4b26a', fontWeight: 600 }}>Train. Recover. Live longer — together.</div>
        </div>
      </div>
    ),
    size,
  )
}
