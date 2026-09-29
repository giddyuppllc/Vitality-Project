import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — The Vitality Project',
}

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-10">
        <p className="text-brand-400 text-sm font-medium uppercase tracking-widest mb-3">Legal</p>
        <h1 className="text-4xl font-bold">Privacy Policy</h1>
        <p className="text-white/30 text-sm mt-3">Last updated: March 2026</p>
      </div>

      <div className="space-y-6 text-white/60 text-sm leading-relaxed">
        {[
          {
            title: 'What We Collect',
            body: 'We collect only the information necessary to fulfill your order: name, email address, shipping address, and order details. We do not collect payment credentials — all payments are processed directly via Zelle or wire transfer outside of our platform.',
          },
          {
            title: 'How We Use Your Information',
            body: 'Your information is used solely to process and fulfill your order, communicate about your order status, and provide customer support. We do not use your data for advertising, profiling, or marketing to third parties.',
          },
          {
            title: 'Data Storage',
            body: 'All data is stored on private, self-hosted infrastructure. We do not use cloud platforms such as AWS, Google Cloud, or Azure to store customer data. Your information does not leave our controlled environment.',
          },
          {
            title: 'Third-Party Sharing',
            body: 'We do not sell, rent, or share your personal information with any third party, including advertising networks, data brokers, or analytics platforms. The only external party that receives any of your information is the shipping carrier, who receives your name and delivery address to fulfill your shipment.',
          },
          {
            title: 'Cookies',
            body: 'We use session cookies for authentication and a single affiliate tracking cookie if you arrive via a referral link. We do not use advertising cookies or third-party tracking pixels.',
          },
          {
            title: 'Data Retention',
            body: 'Order records are retained for a minimum of 3 years for accounting and legal compliance purposes. You may request deletion of your account and associated data at any time, except where retention is required by law.',
          },
          {
            title: 'Your Rights',
            body: 'You have the right to access, correct, or request deletion of your personal data. To exercise these rights, contact us directly. We will respond within 30 days.',
          },
          {
            title: 'Security',
            body: 'We use industry-standard encryption (TLS) for all data in transit. Our servers are hosted on private infrastructure with access controls, firewalls, and regular security audits.',
          },
          {
            title: 'Changes to This Policy',
            body: 'We may update this policy periodically. Material changes will be communicated via email to registered account holders. Continued use of the site constitutes acceptance.',
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
