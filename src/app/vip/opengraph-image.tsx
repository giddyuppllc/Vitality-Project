import { ImageResponse } from 'next/og'

// The store's app/opengraph-image.tsx sits at the app root (its URL must not
// change for vitalityproject.global), so it would otherwise be inherited by
// clubhouse pages. This file overrides it for the vip segment with a neutral,
// name-only card — no store or product wording.
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
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          backgroundColor: '#0c0e1a',
          padding: '80px 100px',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        <div style={{ fontSize: 24, letterSpacing: '0.3em', color: '#8193f8', fontWeight: 700, textTransform: 'uppercase' }}>
          The Vitality Project
        </div>
        <div style={{ marginTop: 24, fontSize: 96, fontWeight: 800, letterSpacing: '-0.03em' }}>Clubhouse</div>
      </div>
    ),
    size,
  )
}
