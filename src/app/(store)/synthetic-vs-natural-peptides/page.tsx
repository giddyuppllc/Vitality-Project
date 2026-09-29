import type { Metadata } from 'next'
import Link from 'next/link'
import {
  FlaskConical,
  TreePine,
  Factory,
  GitCompare,
  ShieldCheck,
  Fingerprint,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Synthetic vs Natural Peptides — The Vitality Project',
  description:
    'Compare synthetic and natural peptides: endogenous production vs SPPS manufacturing, consistency, purity control, and why research relies on synthetic forms for reproducibility.',
}

const sections = [
  {
    icon: TreePine,
    title: 'Natural Peptides: Endogenous Production, Degradation, and Variability',
    content: [
      'Natural peptides are produced endogenously through ribosomal translation or enzymatic processing of larger precursor proteins. Insulin, for example, is synthesized as preproinsulin, processed through the endoplasmic reticulum and Golgi apparatus, and cleaved into its active form before secretion. Endorphins are derived from the precursor protein proopiomelanocortin (POMC) through tissue-specific enzymatic cleavage.',
      'Once released, natural peptides are subject to rapid enzymatic degradation by peptidases and proteases circulating in blood and tissue fluids. Most endogenous peptides have half-lives measured in minutes — sometimes seconds. This rapid turnover is a feature, not a flaw: it allows precise temporal control of signaling. However, it also means that endogenous peptide concentrations fluctuate significantly based on circadian rhythms, metabolic state, stress, age, and individual genetic variation.',
      'This inherent variability is one of the central challenges in studying natural peptides in their native biological context. Concentrations are difficult to standardize, degradation products may have their own biological activity, and the presence of binding proteins and carrier molecules adds further complexity to quantification and interpretation.',
    ],
  },
  {
    icon: Factory,
    title: 'Synthetic Peptides: SPPS Manufacturing, Consistency, and Purity Control',
    content: [
      'Synthetic research peptides are manufactured using Solid-Phase Peptide Synthesis (SPPS), a method developed by Bruce Merrifield in 1963 and refined extensively in the decades since. SPPS builds the peptide chain one amino acid at a time on a solid resin support, using Fmoc (fluorenylmethyloxycarbonyl) or Boc (tert-butyloxycarbonyl) chemistry to protect reactive side chains during each coupling step.',
      'After synthesis is complete, the peptide is cleaved from the resin, deprotected, and purified using reverse-phase high-performance liquid chromatography (RP-HPLC). Identity and purity are confirmed through mass spectrometry (MS) and sometimes amino acid analysis. Research-grade peptides typically achieve purity levels of 98% or higher, with each batch accompanied by a Certificate of Analysis (CoA) documenting molecular weight, purity percentage, and chromatographic data.',
      'The key advantage of SPPS is batch-to-batch consistency. Every vial produced from a validated synthesis protocol contains the same sequence at the same purity — eliminating the biological variability inherent in endogenous peptide production. This consistency is foundational for reproducible research outcomes.',
    ],
  },
  {
    icon: GitCompare,
    title: 'Why Research Uses Synthetic Forms',
    content: [
      'Scientific research demands reproducibility. When studying a peptide\'s effect on a receptor, signaling pathway, or cellular process, investigators need confidence that the compound is identical across experiments, across laboratories, and across time. Synthetic peptides provide this guarantee in a way that extracted or recombinant peptides cannot consistently match.',
      'Scalability is another critical factor. SPPS can produce milligram to gram quantities of a peptide on demand, whereas isolating the same sequence from biological tissue would require impractical volumes of source material and complex purification workflows. Synthetic production also avoids the risk of co-purifying contaminants — other peptides, proteins, lipids, or endotoxins — that could confound experimental results.',
      'Additionally, synthetic peptides can be intentionally modified to improve research utility. Researchers can substitute individual amino acids to study structure-activity relationships, add N-terminal acetylation or C-terminal amidation to improve stability, incorporate non-natural amino acids to resist enzymatic degradation, or attach fluorescent labels and biotin tags for detection and imaging applications.',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Quality Markers: CoA, Purity Testing, and Proper Storage',
    content: [
      'A Certificate of Analysis (CoA) is the standard quality document for research peptides. It should include the peptide sequence, molecular formula, molecular weight (theoretical and observed via MS), purity percentage (determined by HPLC), and appearance. Reputable suppliers provide CoAs generated from third-party independent testing, not just in-house QC.',
      'Purity testing typically involves RP-HPLC with UV detection at 220 nm, which separates the target peptide from truncated sequences, deletion products, and other synthesis-related impurities. Mass spectrometry (ESI-MS or MALDI-TOF) confirms molecular identity. For peptides intended for cell-based research, endotoxin testing (LAL assay) may also be performed.',
      'Proper storage is essential for maintaining peptide integrity. Lyophilized (freeze-dried) peptides should be stored at -20 degrees C in sealed, desiccated containers. Once reconstituted, aliquoting into single-use volumes and storing at -20 degrees C minimizes freeze-thaw degradation. Exposure to heat, moisture, light, and repeated freeze-thaw cycles are the primary causes of peptide degradation in research settings.',
    ],
  },
  {
    icon: Fingerprint,
    title: 'Not Novel Inventions — Engineered Replicas of Biological Structures',
    content: [
      'A common misconception is that synthetic peptides are artificial compounds with no biological precedent. In reality, the vast majority of research peptides are exact sequence replicas of naturally occurring molecules. BPC-157 replicates a fragment of human gastric juice protein. GHK-Cu reproduces a tripeptide found naturally in human plasma. CJC-1295 is an analogue of endogenous growth hormone-releasing hormone (GHRH).',
      'The synthesis process does not create something new — it reproduces something biological with engineering-grade precision. The amino acid sequence, the peptide bond chemistry, and the resulting three-dimensional conformation are identical to what the body produces naturally. The difference is control: synthetic production removes the biological variability, contamination risk, and supply limitations that make working with endogenous peptides impractical at research scale.',
      'This distinction matters for framing peptide research accurately. Synthetic peptides are tools for studying biology, not departures from it. They allow researchers to ask precise questions about receptor function, signaling kinetics, and structure-activity relationships using compounds that are, at the molecular level, indistinguishable from their natural counterparts.',
    ],
  },
]

export default function SyntheticVsNaturalPeptidesPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Hero */}
      <div className="mb-12">
        <p className="text-brand-400 text-sm font-medium uppercase tracking-widest mb-3">
          Peptide Science
        </p>
        <h1 className="text-4xl font-bold mb-4">Synthetic vs Natural Peptides</h1>
        <p className="text-white/50 text-lg leading-relaxed">
          How synthetic research peptides compare to their endogenous counterparts — and why
          laboratory synthesis is the standard for reproducible research.
        </p>
      </div>

      {/* RUO Disclaimer */}
      <div className="glass rounded-xl p-5 mb-10 border border-brand-500/20">
        <div className="flex gap-3">
          <FlaskConical className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
          <p className="text-sm text-white/50 leading-relaxed">
            The information on this page is provided for educational and research purposes only. It
            does not constitute medical advice and is not intended to diagnose, treat, cure, or
            prevent any disease. All products referenced are sold for research use only.
          </p>
        </div>
      </div>

      {/* Overview Block */}
      <div className="glass rounded-2xl p-8 mb-10 border border-brand-500/20">
        <p className="text-brand-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Key Distinction
        </p>
        <p className="text-white/80 text-lg leading-relaxed">
          Synthetic peptides are not novel compounds — they are precision-manufactured replicas of
          naturally occurring biological sequences. The distinction between &ldquo;synthetic&rdquo;
          and &ldquo;natural&rdquo; is one of production method, not molecular identity.
        </p>
      </div>

      {/* Comparison Table */}
      <div className="glass rounded-2xl p-8 mb-8 overflow-x-auto">
        <h2 className="text-xl font-bold mb-6">At a Glance</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/12">
              <th className="text-left py-3 pr-4 text-white/40 font-medium">Parameter</th>
              <th className="text-left py-3 px-4 text-white/40 font-medium">Natural Peptides</th>
              <th className="text-left py-3 pl-4 text-white/40 font-medium">Synthetic Peptides</th>
            </tr>
          </thead>
          <tbody className="text-white/60">
            <tr className="border-b border-white/10">
              <td className="py-3 pr-4 font-medium text-white/80">Source</td>
              <td className="py-3 px-4">Endogenous production, enzymatic cleavage</td>
              <td className="py-3 pl-4">SPPS manufacturing</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="py-3 pr-4 font-medium text-white/80">Purity</td>
              <td className="py-3 px-4">Variable, co-purification challenges</td>
              <td className="py-3 pl-4">Typically 98%+ with HPLC verification</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="py-3 pr-4 font-medium text-white/80">Consistency</td>
              <td className="py-3 px-4">Subject to biological variability</td>
              <td className="py-3 pl-4">Batch-to-batch identical</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="py-3 pr-4 font-medium text-white/80">Scalability</td>
              <td className="py-3 px-4">Limited by biological source</td>
              <td className="py-3 pl-4">On-demand production at any scale</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="py-3 pr-4 font-medium text-white/80">Half-life</td>
              <td className="py-3 px-4">Short (minutes), rapid degradation</td>
              <td className="py-3 pl-4">Can be engineered for stability</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white/80">Documentation</td>
              <td className="py-3 px-4">Characterization varies</td>
              <td className="py-3 pl-4">CoA with MS and HPLC data</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Content Sections */}
      <div className="space-y-8">
        {sections.map((section) => {
          const Icon = section.icon
          return (
            <div key={section.title} className="glass rounded-2xl p-8">
              <div className="flex items-start gap-3 mb-4">
                <Icon className="w-6 h-6 text-brand-400 shrink-0 mt-0.5" />
                <h2 className="text-xl font-bold">{section.title}</h2>
              </div>
              <div className="space-y-4">
                {section.content.map((paragraph, i) => (
                  <p key={i} className="text-white/60 leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          )
        })}

        {/* Core Principle Block */}
        <div className="rounded-2xl p-8 bg-brand-500/10 border border-brand-500/30">
          <p className="text-brand-400 text-xs font-semibold uppercase tracking-widest mb-3">
            Core Principle
          </p>
          <p className="text-gray-900/90 text-lg leading-relaxed font-medium">
            The word &ldquo;synthetic&rdquo; describes the method of production, not the nature of
            the molecule. Research peptides are biologically identical sequences manufactured with
            engineering-grade precision.
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
            Safety &amp; Quality Standards &rarr;
          </Link>
          <Link
            href="/what-are-peptides"
            className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
          >
            What Are Peptides? &rarr;
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
