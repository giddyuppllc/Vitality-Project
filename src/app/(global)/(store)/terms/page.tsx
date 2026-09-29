import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — The Vitality Project',
}

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-10">
        <p className="text-brand-400 text-sm font-medium uppercase tracking-widest mb-3">Legal</p>
        <h1 className="text-4xl font-bold">Terms of Service</h1>
        <p className="text-white/30 text-sm mt-3">Last updated: March 2026</p>
      </div>

      <div className="space-y-6 text-white/60 text-sm leading-relaxed">
        <div className="glass rounded-2xl p-6 border border-brand-500/20">
          <h2 className="font-semibold text-white mb-2">Research Use Only — Critical Notice</h2>
          <p>
            All products sold by The Vitality Project are intended exclusively for in vitro laboratory research and scientific study by qualified professionals. They are <strong className="text-white/80">not</strong> intended for human consumption, veterinary use, diagnostic purposes, or therapeutic application of any kind. These products have not been evaluated by the Food and Drug Administration and are not approved to diagnose, treat, cure, or prevent any disease or condition.
          </p>
          <p className="mt-3">
            By completing a purchase on this site, you represent and warrant that: (1) you are a qualified researcher, scientist, or licensed professional using these compounds for legitimate research purposes; (2) you are at least 18 years of age; and (3) your use of these products complies with all applicable federal, state, and local laws.
          </p>
        </div>

        {[
          {
            title: '1. Acceptance of Terms',
            body: 'By accessing or using The Vitality Project website and purchasing our products, you agree to be bound by these Terms of Service. If you do not agree, do not use this site or purchase our products.',
          },
          {
            title: '2. Eligibility',
            body: 'You must be at least 18 years of age and legally able to enter into binding contracts in your jurisdiction to make a purchase. By placing an order, you represent that you meet these requirements.',
          },
          {
            title: '3. Product Use Restriction',
            body: 'Products are sold strictly for research purposes. Any use of our products for human or animal consumption, therapeutic, diagnostic, or any other non-research purpose is a material breach of these Terms and may violate applicable law. The Vitality Project bears no liability for misuse of any purchased compound.',
          },
          {
            title: '4. Payment',
            body: 'We accept payment via Zelle and wire transfer only. Orders are processed upon receipt and confirmation of payment. Prices are listed in USD and are subject to change without notice.',
          },
          {
            title: '5. Shipping & Risk of Loss',
            body: 'Title and risk of loss for products pass to the buyer upon shipment. The Vitality Project is not responsible for lost or stolen packages once confirmed as delivered by the carrier.',
          },
          {
            title: '6. No Refunds — Replacement Only for Damaged Packaging',
            body: 'All sales are final. We do not issue refunds under any circumstances — including shipping delays, carrier issues, change of mind, partial dissatisfaction, or for any other reason. We do not accept returns. The only remedy we offer is a replacement product when the original arrives with damaged packaging; contact us within 7 days of delivery with photos.',
          },
          {
            title: '7. Limitation of Liability',
            body: 'To the fullest extent permitted by law, The Vitality Project shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of our products or website. Our total liability for any claim shall not exceed the amount paid for the product in question.',
          },
          {
            title: '8. Governing Law',
            body: 'These Terms shall be governed by the laws of the state in which The Vitality Project is registered, without regard to conflict of law principles.',
          },
          {
            title: '9. Changes to Terms',
            body: 'We reserve the right to modify these Terms at any time. Changes are effective upon posting to this page. Continued use of the site constitutes acceptance of the revised Terms.',
          },
        ].map((item) => (
          <div key={item.title} className="glass rounded-2xl p-6">
            <h2 className="font-semibold text-white mb-2">{item.title}</h2>
            <p>{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
