import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ — The Vitality Project',
  description: 'Frequently asked questions about ordering, shipping, and our research compounds.',
}

const faqs = [
  {
    section: 'Ordering & Products',
    items: [
      {
        q: 'What does "Research Use Only" mean?',
        a: 'All products sold by The Vitality Project are strictly intended for in vitro laboratory research. They are not approved for human consumption, clinical use, or veterinary application. By purchasing, you confirm you are a qualified researcher using these compounds for lawful scientific study.',
      },
      {
        q: 'How do I know the quality is legitimate?',
        a: 'Every compound is sourced from verified synthesis laboratories and third-party tested for purity and identity. We require a minimum of 98% purity on all products. Certificates of Analysis are available upon request after purchase.',
      },
      {
        q: 'Are your products lyophilized (freeze-dried)?',
        a: 'Peptide products are supplied in lyophilized powder form in sealed, sterile glass vials. This format is standard for research-grade peptide compounds and ensures maximum shelf stability.',
      },
      {
        q: 'Do you carry products for specific research areas?',
        a: 'Our catalog is organized by research category: Repair & Recovery, Body Composition, Longevity & Aesthetics, and Neuro & Mood. Browse the Shop to find compounds relevant to your area of study.',
      },
    ],
  },
  {
    section: 'Payment',
    items: [
      {
        q: 'Why no credit card processing?',
        a: 'We accept payment via Zelle and wire transfer only. This keeps our customers\' financial data off third-party processing networks and avoids the merchant account complications common in the research compound industry.',
      },
      {
        q: 'How does payment work?',
        a: 'Place your order and you\'ll receive payment instructions immediately on the confirmation page. Send payment with your order number in the memo/reference field. Orders are fulfilled once payment is confirmed, typically within 1 business day.',
      },
      {
        q: 'Is there a minimum order?',
        a: 'No minimum order requirement. You can order a single vial.',
      },
    ],
  },
  {
    section: 'Shipping & Privacy',
    items: [
      {
        q: 'How is my order packaged?',
        a: 'All orders ship in plain, unmarked outer packaging with no company branding, product names, or other identifying information on the exterior. Packing materials are standard and discreet.',
      },
      {
        q: 'How long does shipping take?',
        a: 'Domestic orders typically ship within 1–2 business days of payment confirmation and arrive within 3–7 business days depending on your location. Expedited options are available at checkout.',
      },
      {
        q: 'Do you ship internationally?',
        a: 'We currently ship within the United States only. International shipping may be added in the future.',
      },
      {
        q: 'Is my personal data shared with anyone?',
        a: 'No. We operate on private infrastructure and do not share customer information with third-party platforms, advertising networks, or data brokers. See our Privacy Policy for full details.',
      },
    ],
  },
  {
    section: 'Accounts & Affiliates',
    items: [
      {
        q: 'Do I need an account to order?',
        a: 'You can check out as a guest. Creating an account lets you track orders and view your order history.',
      },
      {
        q: 'How does the affiliate program work?',
        a: 'Approved affiliates receive a unique referral link. When a customer places an order through your link, you earn a commission credited to your account. Apply on the Affiliates page.',
      },
    ],
  },
]

export default function FaqPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-12">
        <p className="text-brand-400 text-sm font-medium uppercase tracking-widest mb-3">Questions</p>
        <h1 className="text-4xl font-bold">Frequently Asked</h1>
      </div>

      <div className="space-y-10">
        {faqs.map((section) => (
          <div key={section.section}>
            <h2 className="text-sm font-semibold text-white/40 uppercase tracking-widest mb-4">{section.section}</h2>
            <div className="space-y-3">
              {section.items.map((item) => (
                <div key={item.q} className="glass rounded-2xl p-6">
                  <h3 className="font-semibold mb-2">{item.q}</h3>
                  <p className="text-white/55 text-sm leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
