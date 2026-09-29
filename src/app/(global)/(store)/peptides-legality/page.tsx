import type { Metadata } from 'next'
import Link from 'next/link'
import { FlaskConical } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Peptide Legality & Regulatory Landscape — The Vitality Project',
  description:
    'Understand the legal status of research peptides in the United States, including RUO classification, FDA status, buyer responsibility, and how regulation is shaping the industry.',
}

export default function PeptidesLegalityPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Hero */}
      <div className="mb-12">
        <p className="text-brand-400 text-sm font-medium uppercase tracking-widest mb-3">
          Compliance
        </p>
        <h1 className="text-4xl font-bold mb-4">Peptide Legality &amp; Regulatory Landscape</h1>
        <p className="text-white/50 text-lg leading-relaxed">
          A clear overview of the legal status of research peptides, regulatory frameworks, and
          buyer responsibilities in the United States.
        </p>
      </div>

      {/* RUO Disclaimer */}
      <div className="glass rounded-xl p-5 mb-10 border border-brand-500/20">
        <div className="flex gap-3">
          <FlaskConical className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
          <p className="text-sm text-white/50 leading-relaxed">
            This page provides general educational information about the regulatory landscape
            surrounding research peptides. It is not legal advice. Consult a qualified legal
            professional for guidance specific to your jurisdiction and use case. All products sold
            by The Vitality Project are for research use only.
          </p>
        </div>
      </div>

      {/* Content Sections */}
      <div className="space-y-8">
        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-3">Research Use Only Classification</h2>
          <p className="text-white/60 leading-relaxed mb-4">
            Research peptides are sold under a Research Use Only (RUO) classification. This
            designation means the compounds are intended exclusively for in vitro laboratory research
            and scientific investigation. They are not manufactured, marketed, or approved for human
            consumption, veterinary use, clinical diagnosis, or therapeutic application.
          </p>
          <p className="text-white/60 leading-relaxed">
            The RUO classification is a well-established category used across the life sciences
            industry for reagents, biological compounds, and chemical tools that serve legitimate
            research purposes. Purchasers of RUO compounds affirm that they understand this
            classification and intend to use the products in accordance with it.
          </p>
        </div>

        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-3">FDA Status of Peptides</h2>
          <p className="text-white/60 leading-relaxed mb-4">
            Peptides sold as research compounds have not been evaluated by the U.S. Food and Drug
            Administration (FDA) for safety, efficacy, or suitability for any clinical purpose. They
            do not carry FDA approval, clearance, or authorization. This is consistent with all RUO
            reagents and compounds used in scientific research.
          </p>
          <p className="text-white/60 leading-relaxed">
            It is important to note that a number of peptide-based molecules have separately been
            developed through the full FDA approval pipeline as pharmaceutical drugs (such as certain
            GLP-1 receptor agonists). Research-grade peptides are distinct from these approved
            pharmaceutical products — they are analytical and research tools, not finished drug
            products.
          </p>
        </div>

        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-3">
            Distinction Between RUO and Clinical Compounds
          </h2>
          <p className="text-white/60 leading-relaxed mb-4">
            The distinction between RUO compounds and clinical-grade pharmaceuticals is critical.
            Clinical compounds undergo Phase I–III clinical trials, receive regulatory approval, are
            manufactured under Current Good Manufacturing Practices (cGMP), and are prescribed by
            licensed healthcare providers for specific medical indications.
          </p>
          <p className="text-white/60 leading-relaxed">
            RUO compounds, by contrast, are manufactured for analytical and investigational use.
            While they may share the same amino acid sequence as a clinically approved peptide, they
            are not produced under cGMP conditions and are not intended or labeled for therapeutic
            use. This distinction governs how they may legally be sold, marketed, and used.
          </p>
        </div>

        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-3">Buyer Responsibility</h2>
          <p className="text-white/60 leading-relaxed mb-4">
            Purchasers of research peptides bear responsibility for ensuring that their acquisition
            and use of these compounds complies with all applicable laws, regulations, and
            institutional policies. By completing a purchase, buyers affirm that:
          </p>
          <ul className="text-white/60 text-sm leading-relaxed space-y-2 mb-4">
            <li>
              • They are acquiring the compounds for legitimate in vitro research or scientific study
            </li>
            <li>
              • They understand the RUO classification and will not use the compounds for human or
              animal consumption
            </li>
            <li>
              • They will handle all compounds according to standard laboratory safety protocols
            </li>
            <li>
              • They will comply with their jurisdiction&apos;s regulations regarding the purchase
              and possession of research compounds
            </li>
          </ul>
          <p className="text-white/60 leading-relaxed">
            The Vitality Project reserves the right to refuse or cancel orders where there is reason
            to believe compounds may be used outside the scope of legitimate research.
          </p>
        </div>

        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-3">State and Federal Considerations</h2>
          <p className="text-white/60 leading-relaxed mb-4">
            At the federal level, most research peptides are not classified as controlled substances
            under the Controlled Substances Act. However, regulatory landscapes can vary by state,
            and certain peptide categories may be subject to specific state-level regulations or
            restrictions.
          </p>
          <p className="text-white/60 leading-relaxed">
            Researchers should familiarize themselves with the laws in their specific state or
            jurisdiction. Institutional researchers should also consult with their organization&apos;s
            compliance office or Institutional Review Board (IRB) as applicable. The regulatory
            environment for peptides is evolving, and staying informed is part of responsible
            research practice.
          </p>
        </div>

        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-3">How Regulation Is Maturing the Industry</h2>
          <p className="text-white/60 leading-relaxed mb-4">
            Increased regulatory attention to the peptide research market is, on balance, a positive
            development. Greater oversight is driving improvements in manufacturing standards,
            testing transparency, and vendor accountability. Suppliers who operate with rigorous
            quality controls, third-party testing, and clear RUO labeling are well-positioned in an
            environment that rewards compliance and transparency.
          </p>
          <p className="text-white/60 leading-relaxed">
            The maturation of the regulatory landscape benefits serious researchers by raising the
            floor for quality across the industry, making it easier to identify trustworthy suppliers,
            and reducing the prevalence of underpurity or misrepresented compounds. The Vitality
            Project views compliance not as a limitation but as a foundation for trust and
            credibility in the research community.
          </p>
        </div>
      </div>

      {/* Internal Links */}
      <div className="mt-16 glass rounded-2xl p-8">
        <h2 className="text-lg font-bold mb-4">Continue Exploring</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/peptides-safety"
            className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
          >
            Peptide Safety &amp; Quality Standards &rarr;
          </Link>
          <Link
            href="/what-are-peptides"
            className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
          >
            What Are Peptides? &rarr;
          </Link>
          <Link
            href="/blog/peptide-regulation"
            className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
          >
            Blog: Peptide Regulation &rarr;
          </Link>
          <Link
            href="/products"
            className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
          >
            Browse the Shop &rarr;
          </Link>
        </div>
      </div>
    </div>
  )
}
