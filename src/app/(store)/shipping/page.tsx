import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Shipping Policy — The Vitality Project',
}

export default function ShippingPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-10">
        <p className="text-brand-400 text-sm font-medium uppercase tracking-widest mb-3">Policies</p>
        <h1 className="text-4xl font-bold">Shipping Policy</h1>
      </div>

      <div className="space-y-6 text-white/60 text-sm leading-relaxed">
        {[
          {
            title: 'Processing Time',
            body: 'Orders are processed within 1–2 business days after payment is confirmed. Orders placed on weekends or holidays are processed the next business day.',
          },
          {
            title: 'Domestic Shipping (US)',
            body: 'Standard shipping: 3–7 business days. Expedited shipping options are available at checkout. We currently ship within the United States only.',
          },
          {
            title: 'Packaging',
            body: 'All orders ship in plain, unmarked exterior packaging. No company name, product names, or branded materials appear on the outside of the package. Interior packing includes proper cold-chain materials where applicable.',
          },
          {
            title: 'Tracking',
            body: 'A tracking number will be provided via email once your order has shipped. You can also view tracking information in your account under Order History.',
          },
          {
            title: 'Damaged Packaging — Replacement Only',
            body: 'If your order arrives with damaged packaging, contact us within 7 days of delivery with photos. We will ship a replacement at no cost. Replacement is the only remedy offered — no refunds are issued for damaged shipments.',
          },
          {
            title: 'No Refunds',
            body: 'All sales are final. We do not issue refunds under any circumstances — including shipping delays, carrier issues, change of mind, or any other reason. The only remedy we offer is a replacement product when the original arrives with damaged packaging (see above).',
          },
          {
            title: 'Shipping Delays',
            body: 'Carrier delays are outside our control. Once your package leaves our facility, transit time is the carrier\'s responsibility. Shipping delays do not qualify for refunds, store credit, or expedited reshipment.',
          },
          {
            title: 'Legal Compliance',
            body: 'It is the buyer\'s responsibility to ensure that the products ordered are legal to purchase and receive in their jurisdiction. All products are sold as research compounds only and must comply with applicable local, state, and federal laws.',
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
