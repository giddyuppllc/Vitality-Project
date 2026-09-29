/**
 * "VP" monogram for the clubhouse — an original mark drawn for .vip (09-29):
 * a white V and a champagne-gold P on a deep-navy tile with a hairline
 * vital-blue edge. Same geometry as src/app/vip/icon.svg.
 */
export const MONOGRAM_PATHS = {
  v: 'M13 19 L23.5 45 L34 19',
  p: 'M38 45 V19 H44.5 a7.5 7.5 0 0 1 0 15 H38',
}

export function Monogram({ size = 36, className, title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect x="1" y="1" width="62" height="62" rx="16" fill="#0b1322" stroke="#82c3ff" strokeOpacity="0.35" strokeWidth="1.5" />
      <path d={MONOGRAM_PATHS.v} fill="none" stroke="#ffffff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={MONOGRAM_PATHS.p} fill="none" stroke="#d4b26a" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
