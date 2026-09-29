import { VIP_COPY } from '@/lib/vip/copy'
import { PublicPage } from '@/components/vip/public-page'

export const metadata = { title: 'Guidelines' }

export default function GuidelinesPage() {
  const G = VIP_COPY.guidelines
  return (
    <PublicPage>
      <p className="vip-kicker">Community</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{G.title}</h1>
      <p className="mt-3 text-lg leading-relaxed text-white/70">{G.intro}</p>
      <ol className="mt-8 space-y-3">
        {G.rules.map((r, i) => (
          <li key={r.title} className="vip-surface flex gap-4 p-5">
            <span className="vip-gold w-6 shrink-0 text-lg font-extrabold">{i + 1}</span>
            <div>
              <h2 className="font-semibold">{r.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-white/68">{r.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-8 text-white/70">{G.closing}</p>
    </PublicPage>
  )
}
