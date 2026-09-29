import type { Metadata } from 'next'
import Link from 'next/link'
import {
  FlaskConical,
  Radio,
  Zap,
  Layers,
  Send,
  Target,
  Microscope,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Peptide Signaling Explained — The Vitality Project',
  description:
    'Deep dive into peptide signaling at the cellular level. Explore GPCRs, receptor tyrosine kinases, intracellular cascades, and why peptide signaling matters for precision research.',
}

const sections = [
  {
    icon: Radio,
    title: 'G-Protein Coupled Receptors (GPCRs)',
    content: [
      'GPCRs are the largest family of membrane receptors in the human genome, with over 800 identified members. They are the primary interface through which peptide signals are transduced across the cell membrane. When a peptide ligand binds to the extracellular domain of a GPCR, the receptor undergoes a conformational change that activates an associated intracellular G-protein complex.',
      'The activated G-protein dissociates into alpha and beta-gamma subunits, each capable of triggering distinct downstream signaling pathways — including cAMP production via adenylyl cyclase, calcium release through phospholipase C, and MAPK cascade activation. The diversity of GPCR subtypes allows peptides to achieve highly specific cellular responses depending on receptor expression patterns in different tissues.',
      'Many endogenous peptides — including somatostatin, oxytocin, and GnRH — exert their biological effects exclusively through GPCR-mediated signaling, making this receptor family a central focus of peptide research.',
    ],
  },
  {
    icon: Zap,
    title: 'Receptor Tyrosine Kinases (RTKs)',
    content: [
      'Receptor tyrosine kinases represent a second major class of peptide-responsive receptors. Unlike GPCRs, RTKs have intrinsic enzymatic activity: when a peptide growth factor binds the extracellular domain, the receptor dimerizes and autophosphorylates specific tyrosine residues on its intracellular domain.',
      'These phosphorylated residues serve as docking sites for adaptor proteins and signaling enzymes, triggering cascades such as the PI3K/Akt pathway (involved in cell survival and growth) and the Ras/MAPK pathway (involved in proliferation and differentiation). Peptide ligands such as insulin, EGF, and IGF-1 signal through RTK mechanisms.',
      'The kinase activity of RTKs provides an amplification mechanism — a single receptor activation event can phosphorylate multiple downstream substrates, creating a robust and sustained cellular response. This amplification is one reason RTK-mediated peptide signals can produce lasting biological effects even from brief receptor occupancy.',
    ],
  },
  {
    icon: Layers,
    title: 'Intracellular Signaling Cascades',
    content: [
      'Once a peptide-receptor interaction initiates a signal at the cell membrane, the message is propagated through intracellular cascades — sequential activation of kinases, phosphatases, second messengers, and transcription factors. These cascades amplify, integrate, and refine the original signal before it reaches the nucleus or other effector systems.',
      'Key cascades in peptide signaling include the cAMP/PKA pathway, the calcium/calmodulin pathway, the JAK/STAT pathway, and the MAPK/ERK pathway. Each cascade has distinct kinetics, duration, and downstream targets. Importantly, multiple cascades can be activated simultaneously by a single peptide-receptor event, enabling complex cellular responses from a single molecular input.',
      'The concept of signal integration is critical: cells do not respond to peptide signals in isolation. The final biological output depends on the convergence of multiple signaling inputs, the cell type, the receptor density, and the current metabolic state of the cell.',
    ],
  },
  {
    icon: Send,
    title: 'Autocrine, Paracrine, and Endocrine Signaling',
    content: [
      'Peptide signals operate across three spatial scales. In autocrine signaling, a cell secretes a peptide that binds to receptors on its own surface — a self-regulatory feedback loop commonly observed in immune cells and during tissue repair. In paracrine signaling, secreted peptides act on nearby cells within the local microenvironment, enabling coordinated responses across a tissue without systemic distribution.',
      'Endocrine signaling involves peptides released into the bloodstream to act on distant target organs. Classic peptide hormones — insulin from pancreatic beta cells, growth hormone-releasing hormone from the hypothalamus, and atrial natriuretic peptide from cardiac tissue — all operate through endocrine mechanisms.',
      'Understanding which signaling mode a peptide utilizes is essential for research design. The effective concentration, half-life, and degradation kinetics differ dramatically between autocrine, paracrine, and endocrine contexts, directly influencing experimental parameters and outcomes.',
    ],
  },
  {
    icon: Target,
    title: 'Specificity and Selectivity in Peptide-Receptor Interactions',
    content: [
      'The hallmark of peptide signaling is specificity. A peptide\'s amino acid sequence determines its three-dimensional conformation, which in turn determines which receptor binding pocket it can occupy. This geometric complementarity — often described as an induced-fit model — ensures that each peptide activates only its cognate receptor or a closely related receptor subtype.',
      'Selectivity is further refined by tissue-specific receptor expression. A peptide circulating systemically will only produce effects in tissues that express its target receptor at sufficient density. This natural targeting mechanism is one reason peptide signaling systems produce fewer off-target effects compared to small-molecule compounds that may interact with multiple receptor families.',
      'Research into peptide-receptor selectivity has led to the development of synthetic analogues with enhanced binding affinity, extended half-lives, or modified receptor selectivity profiles — enabling investigators to probe specific pathways with unprecedented precision.',
    ],
  },
  {
    icon: Microscope,
    title: 'Why Peptide Signaling Is Studied for Precision Research',
    content: [
      'The precision of peptide signaling makes it an ideal model system for studying biological regulation. Unlike broad-spectrum compounds that affect multiple targets simultaneously, peptides allow researchers to activate or inhibit individual signaling pathways in isolation. This enables clean experimental designs with clearly attributable outcomes.',
      'Advances in solid-phase peptide synthesis (SPPS) have made it possible to produce custom peptide sequences rapidly and at high purity, allowing researchers to systematically modify individual residues and study the resulting changes in receptor binding, signaling kinetics, and biological response. Structure-activity relationship (SAR) studies using synthetic peptides have become a cornerstone of modern pharmacological and biochemical research.',
      'As the library of characterized peptide sequences continues to expand — and as analytical tools like cryo-EM and molecular dynamics simulation improve our understanding of receptor-ligand interactions — peptide signaling research is positioned at the forefront of precision biology.',
    ],
  },
]

export default function PeptideSignalingExplainedPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Hero */}
      <div className="mb-12">
        <p className="text-brand-400 text-sm font-medium uppercase tracking-widest mb-3">
          Cellular Mechanisms
        </p>
        <h1 className="text-4xl font-bold mb-4">Peptide Signaling Explained</h1>
        <p className="text-white/50 text-lg leading-relaxed">
          How peptide signals are transmitted, received, and processed at the cellular level —
          from receptor binding to intracellular cascades.
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
          Overview
        </p>
        <p className="text-white/80 text-lg leading-relaxed">
          Peptide signaling is the process by which short-chain amino acid sequences bind to
          specific membrane receptors and trigger intracellular events that regulate gene expression,
          metabolism, growth, repair, and homeostasis. It is one of the most conserved and precisely
          regulated communication systems in biology.
        </p>
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
            Peptide signaling is not pharmacological intervention — it is biological communication.
            Research peptides allow investigators to study these native signaling systems with
            molecular precision.
          </p>
        </div>
      </div>

      {/* Internal Links */}
      <div className="mt-16 glass rounded-2xl p-8">
        <h2 className="text-lg font-bold mb-4">Continue Exploring</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/how-peptides-work"
            className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
          >
            How Peptides Work &rarr;
          </Link>
          <Link
            href="/what-are-peptides"
            className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
          >
            What Are Peptides? &rarr;
          </Link>
          <Link
            href="/blog/peptides-vs-pharma"
            className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
          >
            Blog: Peptides vs Pharma &rarr;
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
