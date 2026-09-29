import type { Metadata } from 'next'
import Link from 'next/link'
import {
  FlaskConical,
  ShieldCheck,
  FileCheck,
  Factory,
  Snowflake,
  Search,
  Scale,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Peptide Safety & Quality Standards — The Vitality Project',
  description:
    'Learn about peptide safety, purity testing, third-party Certificates of Analysis, SPPS manufacturing, storage protocols, and quality standards for research-grade compounds.',
}

const qualitySections = [
  {
    icon: ShieldCheck,
    title: 'Purity Testing: 98% Minimum Standard',
    body: 'All research-grade peptides carried by The Vitality Project meet or exceed a 98% purity threshold. Purity is determined through High-Performance Liquid Chromatography (HPLC) analysis, which separates the target peptide from synthesis byproducts, truncated sequences, and other impurities. Mass spectrometry is used in conjunction with HPLC to verify molecular identity and confirm that the peptide matches its expected molecular weight and amino acid sequence. These dual-verification methods represent the gold standard in peptide quality assurance.',
  },
  {
    icon: FileCheck,
    title: 'Third-Party Certificate of Analysis',
    body: 'Every batch of peptide is tested by an independent, third-party analytical laboratory — not by the manufacturer itself. The resulting Certificate of Analysis (CoA) documents purity percentage, molecular weight confirmation, appearance, solubility, and any detected impurities. CoAs are available upon request for all products. Third-party testing eliminates the conflict of interest inherent in self-reported quality data and provides researchers with an objective verification of compound integrity.',
  },
  {
    icon: Factory,
    title: 'SPPS Manufacturing Standards',
    body: 'Research-grade peptides are synthesized using Solid-Phase Peptide Synthesis (SPPS), a well-established methodology that allows precise, stepwise construction of amino acid chains on a solid resin support. After synthesis, peptides undergo cleavage, deprotection, and multi-step HPLC purification. Reputable synthesis facilities operate under controlled cleanroom conditions with documented Standard Operating Procedures (SOPs) for each stage of production. The Vitality Project sources exclusively from verified synthesis facilities with established quality track records.',
  },
  {
    icon: Snowflake,
    title: 'Storage & Handling',
    body: 'Peptide products are supplied in lyophilized (freeze-dried) powder form in sealed, sterile glass vials. Lyophilization removes water from the peptide solution, resulting in a stable powder with a significantly extended shelf life compared to liquid formulations. For optimal stability, lyophilized peptides should be stored refrigerated at 2–8°C for short-term use, or frozen at -20°C for long-term storage. Once reconstituted, peptides should be aliquoted to avoid repeated freeze-thaw cycles and used within the timeframe specified for each compound.',
  },
  {
    icon: Search,
    title: 'Quality Markers to Look For',
    body: 'When evaluating any research peptide supplier, the following quality markers are essential: independent third-party CoA for every batch (not self-reported), HPLC purity of 98% or higher, mass spectrometry identity confirmation, lyophilized format in sealed vials, clear labeling with peptide name, quantity, lot number, and storage instructions, and transparent sourcing information. The absence of any of these markers should be considered a red flag. Researchers should be particularly cautious of vendors who do not provide CoAs or who provide only manufacturer-generated documentation.',
  },
  {
    icon: Scale,
    title: 'RUO Context & Responsible Research',
    body: 'All products sold by The Vitality Project are classified as Research Use Only (RUO). They are not approved for human consumption, veterinary use, clinical diagnosis, or therapeutic application. They have not been evaluated by the FDA or any other regulatory body for safety or efficacy in humans. Responsible research requires adherence to applicable institutional, local, state, and federal regulations. Researchers are expected to handle all compounds according to standard laboratory safety protocols and to maintain appropriate documentation of their research activities.',
  },
]

export default function PeptidesSafetyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Hero */}
      <div className="mb-12">
        <p className="text-brand-400 text-sm font-medium uppercase tracking-widest mb-3">
          Quality Assurance
        </p>
        <h1 className="text-4xl font-bold mb-4">Peptide Safety &amp; Quality Standards</h1>
        <p className="text-white/50 text-lg leading-relaxed">
          How research-grade peptides are tested, manufactured, and stored — and what quality
          markers serious researchers should look for.
        </p>
      </div>

      {/* RUO Disclaimer */}
      <div className="glass rounded-xl p-5 mb-10 border border-brand-500/20">
        <div className="flex gap-3">
          <FlaskConical className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
          <p className="text-sm text-white/50 leading-relaxed">
            All products sold by The Vitality Project are for research use only. They are not
            intended for human consumption and have not been evaluated by the FDA. The information
            below describes quality standards applied to research-grade compounds.
          </p>
        </div>
      </div>

      {/* Quality Section Cards */}
      <div className="space-y-6">
        {qualitySections.map((section) => (
          <div key={section.title} className="glass rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                <section.icon className="w-4.5 h-4.5 text-brand-400" />
              </div>
              <h2 className="text-xl font-bold">{section.title}</h2>
            </div>
            <p className="text-white/60 leading-relaxed">{section.body}</p>
          </div>
        ))}
      </div>

      {/* Internal Links */}
      <div className="mt-16 glass rounded-2xl p-8">
        <h2 className="text-lg font-bold mb-4">Continue Exploring</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/what-are-peptides"
            className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
          >
            What Are Peptides? &rarr;
          </Link>
          <Link
            href="/peptides-legality"
            className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
          >
            Peptide Legality &amp; Regulation &rarr;
          </Link>
          <Link
            href="/blog/peptide-supply-chain"
            className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
          >
            Blog: Peptide Supply Chain &rarr;
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
