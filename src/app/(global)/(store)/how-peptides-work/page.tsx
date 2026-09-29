import type { Metadata } from 'next'
import Link from 'next/link'
import { FlaskConical } from 'lucide-react'

export const metadata: Metadata = {
  title: 'How Peptides Work — Receptor Binding & Signaling — The Vitality Project',
  description:
    'Learn how peptides interact with biological receptors to initiate signaling cascades. Explore receptor binding, signal transduction, and pathway specificity in peptide research.',
}

export default function HowPeptidesWorkPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Hero */}
      <div className="mb-12">
        <p className="text-brand-400 text-sm font-medium uppercase tracking-widest mb-3">
          Mechanism of Action
        </p>
        <h1 className="text-4xl font-bold mb-4">How Peptides Work</h1>
        <p className="text-white/50 text-lg leading-relaxed">
          Understanding receptor binding, signal transduction, and the precision that makes peptides
          a cornerstone of modern biological research.
        </p>
      </div>

      {/* RUO Disclaimer */}
      <div className="glass rounded-xl p-5 mb-10 border border-brand-500/20">
        <div className="flex gap-3">
          <FlaskConical className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
          <p className="text-sm text-white/50 leading-relaxed">
            This page describes biological mechanisms studied in academic and preclinical research.
            It is not medical advice. All products sold by The Vitality Project are for research use
            only and are not approved for human consumption.
          </p>
        </div>
      </div>

      {/* Content Sections */}
      <div className="space-y-8">
        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-3">Receptor Binding: The First Step</h2>
          <p className="text-white/60 leading-relaxed mb-4">
            Peptides exert their biological effects by binding to specific receptors — protein
            structures embedded in cell membranes or located within the cell interior. Each receptor
            has a binding pocket with a unique three-dimensional shape and charge distribution. When
            a peptide with the complementary structure encounters that receptor, it docks into the
            binding site with high affinity and specificity.
          </p>
          <p className="text-white/60 leading-relaxed">
            This interaction is often described using the &quot;induced fit&quot; model: the receptor
            undergoes a subtle conformational change upon peptide binding, which activates the
            receptor and prepares it to transmit a signal to the cell interior. The precision of this
            fit is what distinguishes peptide signaling from broader pharmacological mechanisms —
            peptides engage their targets with minimal off-target interaction.
          </p>
        </div>

        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-3">Signal Transduction</h2>
          <p className="text-white/60 leading-relaxed mb-4">
            Once a peptide binds its receptor, the activated receptor initiates an intracellular
            signaling cascade — a chain of molecular events that amplifies and transmits the message
            deeper into the cell. Common transduction pathways studied in peptide research include:
          </p>
          <ul className="text-white/60 text-sm leading-relaxed space-y-2 mb-4">
            <li>
              <span className="text-brand-400 font-medium">G-protein coupled receptor (GPCR) pathways</span>{' '}
              — The largest family of membrane receptors, GPCRs relay signals through intracellular
              G-proteins that activate secondary messengers such as cAMP or calcium ions.
            </li>
            <li>
              <span className="text-brand-400 font-medium">Receptor tyrosine kinase (RTK) pathways</span>{' '}
              — Peptide growth factors and certain hormones signal through RTKs, which
              autophosphorylate upon ligand binding and activate downstream cascades including
              MAPK/ERK and PI3K/Akt.
            </li>
            <li>
              <span className="text-brand-400 font-medium">JAK-STAT signaling</span> — Cytokine
              and growth hormone-related peptides often signal through the JAK-STAT pathway,
              influencing gene transcription and cellular differentiation.
            </li>
          </ul>
          <p className="text-white/60 leading-relaxed">
            Each of these pathways has been extensively characterized in the literature, and
            peptide-receptor interactions remain a central focus of pharmacological and biochemical
            research.
          </p>
        </div>

        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-3">Pathway Specificity vs Broad Compounds</h2>
          <p className="text-white/60 leading-relaxed mb-4">
            One of the most significant advantages of peptides as research tools is their pathway
            specificity. Unlike many small-molecule compounds that interact with multiple receptor
            types or enzymes simultaneously, peptides are typically designed — by nature or by
            synthesis — to engage a single receptor or a narrow family of related receptors.
          </p>
          <p className="text-white/60 leading-relaxed">
            This specificity allows researchers to isolate and study individual pathways without the
            confounding effects of off-target activity. In preclinical models, this property makes
            peptides invaluable for mapping signaling networks, identifying downstream effectors, and
            understanding the causal relationships between receptor activation and biological
            outcomes.
          </p>
        </div>

        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-3">The Role of Sequence in Determining Function</h2>
          <p className="text-white/60 leading-relaxed mb-4">
            A peptide&apos;s amino acid sequence is the sole determinant of its receptor target and
            signaling behavior. Even minor modifications — substituting a single amino acid,
            altering chirality from L- to D-form, or adding a protective group — can dramatically
            change binding affinity, metabolic stability, or receptor selectivity.
          </p>
          <p className="text-white/60 leading-relaxed">
            This structure-activity relationship (SAR) is one of the most active areas of peptide
            research. By systematically modifying sequences and measuring the resulting changes in
            biological activity, researchers build detailed maps of how molecular structure translates
            to function — knowledge that informs both basic science and applied research.
          </p>
        </div>

        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-3">Categories of Peptide Signaling</h2>
          <p className="text-white/60 leading-relaxed mb-4">
            Peptide signaling spans virtually every major biological system. The following categories
            represent the most actively investigated areas in current preclinical research:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="rounded-xl bg-white/5 p-4">
              <p className="text-brand-400 text-sm font-semibold mb-1">Metabolic Signaling</p>
              <p className="text-white/50 text-sm leading-relaxed">
                Peptides studied for their role in glucose regulation, lipid metabolism, appetite
                signaling, and energy homeostasis. Includes GLP-1 analogues and ghrelin-related
                sequences.
              </p>
            </div>
            <div className="rounded-xl bg-white/5 p-4">
              <p className="text-brand-400 text-sm font-semibold mb-1">Repair &amp; Recovery</p>
              <p className="text-white/50 text-sm leading-relaxed">
                Peptides investigated for fibroblast activation, collagen synthesis, angiogenesis,
                and connective tissue remodeling in preclinical models.
              </p>
            </div>
            <div className="rounded-xl bg-white/5 p-4">
              <p className="text-brand-400 text-sm font-semibold mb-1">Immune Modulation</p>
              <p className="text-white/50 text-sm leading-relaxed">
                Thymic peptides and antimicrobial sequences studied for their effects on T-cell
                maturation, cytokine regulation, and innate immune function.
              </p>
            </div>
            <div className="rounded-xl bg-white/5 p-4">
              <p className="text-brand-400 text-sm font-semibold mb-1">Neuromodulatory</p>
              <p className="text-white/50 text-sm leading-relaxed">
                Peptides examined for interactions with GABAergic, serotonergic, and dopaminergic
                pathways in behavioral and cognitive research models.
              </p>
            </div>
          </div>
        </div>
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
            href="/peptide-signaling-explained"
            className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
          >
            Peptide Signaling Explained &rarr;
          </Link>
          <Link
            href="/blog/peptides-vs-pharma"
            className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
          >
            Blog: Peptides vs Pharma &rarr;
          </Link>
          <Link
            href="/products?category=repair-recovery"
            className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
          >
            Shop: Repair &amp; Recovery &rarr;
          </Link>
        </div>
      </div>
    </div>
  )
}
