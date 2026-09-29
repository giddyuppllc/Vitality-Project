import { VIP_COPY } from '@/lib/vip/copy'
import { PublicPage } from '@/components/vip/public-page'

export const metadata = { title: 'Privacy' }

export default function ClubhousePrivacyPage() {
  const P = VIP_COPY.privacy
  return (
    <PublicPage>
      <p className="vip-kicker">Your data</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{P.title}</h1>
      <p className="mt-3 text-lg leading-relaxed text-white/70">{P.intro}</p>
      <div className="mt-8 space-y-3">
        {P.sections.map((s) => (
          <section key={s.title} className="vip-surface p-5">
            <h2 className="font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-white/68">{s.body}</p>
          </section>
        ))}
      </div>
    </PublicPage>
  )
}
