import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About — The Vitality Project',
  description: 'Our mission, values, and commitment to research-grade quality.',
}

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-12">
        <p className="text-brand-400 text-sm font-medium uppercase tracking-widest mb-3">Our Story</p>
        <h1 className="text-4xl font-bold mb-4">Built for serious researchers.</h1>
        <p className="text-white/50 text-lg leading-relaxed">
          The Vitality Project was founded on a simple premise: access to research-grade compounds shouldn't require navigating a maze of gray-market vendors with no accountability.
        </p>
      </div>

      <div className="space-y-8">
        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-3">Who We Serve</h2>
          <p className="text-white/60 leading-relaxed">
            Our customers are fitness researchers, independent scientists, longevity enthusiasts, and practitioners who need reliable access to high-purity compounds for controlled study. Whether you are investigating tissue repair mechanisms, exploring body composition research, studying cellular longevity pathways, or examining neuro-modulatory peptides — we source with the rigor your work demands.
          </p>
        </div>

        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-3">Quality Without Compromise</h2>
          <p className="text-white/60 leading-relaxed">
            Every compound we carry is sourced from verified synthesis facilities and tested by independent third-party laboratories. We require a minimum of 98% purity and provide Certificates of Analysis upon request. We do not blend, dilute, or misrepresent what is in each vial.
          </p>
        </div>

        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-3">Privacy First</h2>
          <p className="text-white/60 leading-relaxed">
            We run on private infrastructure. Your order data, contact information, and purchase history are never shared with third-party platforms, advertising networks, or data brokers. We ship discreetly with no identifying brand information on exterior packaging.
          </p>
        </div>

        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-3">Research Use Only</h2>
          <p className="text-white/60 leading-relaxed">
            All products sold by The Vitality Project are strictly for in vitro research and laboratory study. They are not for human or animal consumption, diagnostic use, or therapeutic application, and have not been evaluated by the FDA. We take compliance seriously and expect our customers to as well.
          </p>
        </div>
      </div>
    </div>
  )
}
