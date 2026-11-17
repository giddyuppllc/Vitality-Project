/**
 * Lightweight SVG charts (no chart library). Single series each, so no legend:
 * the heading names the series. Every mark carries a native hover tooltip
 * (<title>) and every chart ships a screen-reader table of its numbers.
 * Server-safe.
 */

export interface Datum {
  label: string
  value: number
  /** Tooltip / table text for the value. */
  display: string
}

const W = 400
const PAD = { top: 22, right: 8, bottom: 32, left: 8 }

function niceMax(v: number) {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}

function SrTable({ caption, data }: { caption: string; data: Datum[] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <tbody>
        {data.map((d, i) => (
          <tr key={i}>
            <th scope="row">{d.label}</th>
            <td>{d.display}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Vertical bars, rounded data-end, 2px gap; every other x label when crowded. */
export function BarChart({ data, caption, height = 150 }: { data: Datum[]; caption: string; height?: number }) {
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)))
  const innerW = W - PAD.left - PAD.right
  const innerH = height - PAD.top - PAD.bottom
  const slot = innerW / Math.max(1, data.length)
  const bw = Math.max(4, Math.min(28, slot - 4))
  const every = data.length > 8 ? 3 : data.length > 5 ? 2 : 1
  return (
    <figure className="m-0 max-w-[560px]">
      <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full" role="img" aria-label={caption}>
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top} y2={PAD.top} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="3 4" />
        {data.map((d, i) => {
          const h = d.value > 0 ? Math.max(3, (d.value / max) * innerH) : 0
          const x = PAD.left + slot * i + (slot - bw) / 2
          const y = PAD.top + innerH - h
          const r = Math.min(4, bw / 2, h)
          return (
            <g key={i}>
              <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={innerH} fill="transparent">
                <title>{`${d.label}: ${d.display}`}</title>
              </rect>
              {h > 0 && (
                <path
                  d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${y + h} Z`}
                  fill="#4aa3f7"
                  pointerEvents="none"
                />
              )}
              {i % every === (data.length - 1) % every && (
                <text x={x + bw / 2} y={height - 9} textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.6)">
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <SrTable caption={caption} data={data} />
    </figure>
  )
}

/** 2px line with ≥8px markers; first/last values labelled directly. */
export function LineChart({ data, caption, height = 160 }: { data: Datum[]; caption: string; height?: number }) {
  if (data.length === 0) return null
  const vals = data.map((d) => d.value)
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const span = hi - lo || Math.max(1, hi * 0.1)
  const min = lo - span * 0.15
  const max = hi + span * 0.15
  const innerW = W - PAD.left - PAD.right - 36
  const innerH = height - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + 18 + (data.length === 1 ? innerW / 2 : (innerW * i) / (data.length - 1))
  const y = (v: number) => PAD.top + innerH - ((v - min) / (max - min)) * innerH
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ')
  const last = data.length - 1
  return (
    <figure className="m-0 max-w-[560px]">
      <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full" role="img" aria-label={caption}>
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        <path d={path} fill="none" stroke="#4aa3f7" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.value)} r="4" fill="#4aa3f7" stroke="#0f1729" strokeWidth="2" />
            <circle cx={x(i)} cy={y(d.value)} r="14" fill="transparent">
              <title>{`${d.label}: ${d.display}`}</title>
            </circle>
          </g>
        ))}
        {[0, last].filter((v, i, a) => a.indexOf(v) === i).map((i) => (
          <text
            key={`v${i}`}
            x={x(i)}
            y={y(data[i].value) - 12}
            textAnchor={i === 0 && last > 0 ? 'start' : 'end'}
            fontSize="14"
            fontWeight="600"
            fill="rgba(255,255,255,0.85)"
          >
            {data[i].display}
          </text>
        ))}
        <text x={x(0)} y={height - 9} textAnchor="start" fontSize="13" fill="rgba(255,255,255,0.6)">
          {data[0].label}
        </text>
        {last > 0 && (
          <text x={x(last)} y={height - 9} textAnchor="end" fontSize="13" fill="rgba(255,255,255,0.6)">
            {data[last].label}
          </text>
        )}
      </svg>
      <SrTable caption={caption} data={data} />
    </figure>
  )
}

/** Hero number tile. */
export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="vip-surface px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-white/55">{sub}</p>}
    </div>
  )
}
