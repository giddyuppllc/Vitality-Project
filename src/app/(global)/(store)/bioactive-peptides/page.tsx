import type { Metadata } from 'next'
import Link from 'next/link'
import {
  FlaskConical,
  Dna,
  Leaf,
  Waves,
  Cog,
  Beaker,
  Library,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Bioactive Peptides — The Vitality Project',
  description:
    'Learn what makes a peptide bioactive, including classification, natural and synthetic sources, mechanisms of bioactivity, and research applications across biological systems.',
}

const sections = [
  {
    icon: Dna,
    title: 'Definition and Classification',
    content: [
      'A bioactive peptide is any short amino acid sequence — typically between 2 and 50 residues — that exerts a measurable biological effect upon interaction with a cellular target. Unlike inert structural fragments, bioactive peptides possess specific conformations and charge distributions that allow them to bind receptors, modulate enzymes, or influence gene expression.',
      'Bioactive peptides are classified by function and mechanism: antimicrobial peptides disrupt microbial membranes; opioid peptides bind to mu, delta, and kappa receptors in the nervous system; antihypertensive peptides inhibit angiotensin-converting enzyme (ACE); immunomodulatory peptides regulate cytokine production and immune cell activation. Some peptides exhibit multifunctional bioactivity, acting on multiple targets through distinct mechanisms.',
      'Classification can also follow structural criteria — linear vs. cyclic, cationic vs. anionic, amphipathic vs. hydrophobic — each of which influences receptor selectivity, membrane permeability, and metabolic stability. Understanding these structural determinants is foundational to predicting and engineering bioactivity.',
    ],
  },
  {
    icon: Leaf,
    title: 'Sources: Endogenous, Plant, Marine, Fungal, and Synthetic',
    content: [
      'Endogenous bioactive peptides are produced naturally within the body. Insulin, glucagon, oxytocin, bradykinin, and the endorphins are all examples of endogenous peptides that regulate critical physiological processes. These molecules serve as the biological templates for much of modern peptide research.',
      'Plant-derived bioactive peptides have been identified in soy, wheat, rice, and legume proteins, typically released during enzymatic digestion. These peptides have been studied for ACE-inhibitory, antioxidant, and anti-inflammatory properties. Marine organisms represent an especially rich source: cone snail venoms contain peptides with extraordinary receptor specificity, while peptides isolated from fish, algae, and crustacean hydrolysates have demonstrated antimicrobial and immunomodulatory effects.',
      'Fungal bioactive peptides — including cyclosporin (from Tolypocladium inflatum) and ergot peptides — have been extensively characterized for their immunosuppressive and vasoactive properties. Synthetic peptides, produced via SPPS, replicate or modify these naturally occurring sequences, enabling researchers to study bioactivity under controlled, reproducible conditions with defined purity standards.',
    ],
  },
  {
    icon: Cog,
    title: 'Mechanisms of Bioactivity',
    content: [
      'Bioactive peptides exert their effects through several distinct mechanisms. Receptor-mediated signaling is the most common: the peptide binds a membrane receptor (GPCR, RTK, or ion channel), triggering an intracellular cascade that alters cellular behavior. The specificity of this interaction — determined by the peptide\'s sequence and conformation — dictates the downstream response.',
      'Enzyme inhibition is another key mechanism. Certain peptide sequences act as competitive inhibitors by mimicking the natural substrate of an enzyme, binding to its active site and blocking catalytic activity. ACE-inhibitory peptides and protease inhibitors operate through this mechanism. Membrane disruption is characteristic of antimicrobial peptides, which insert into microbial lipid bilayers through electrostatic and hydrophobic interactions, forming pores that compromise membrane integrity.',
      'Some bioactive peptides act as allosteric modulators, binding to sites distinct from the active site and altering the receptor or enzyme\'s conformational dynamics. Others function as carrier peptides, facilitating the transport of ions or small molecules across biological membranes. The diversity of these mechanisms is what makes bioactive peptides such versatile tools in research.',
    ],
  },
  {
    icon: Beaker,
    title: 'Research Applications Across Biological Systems',
    content: [
      'In metabolic research, bioactive peptides are used to study insulin signaling, appetite regulation, glucose homeostasis, and lipid metabolism. GLP-1 analogues and ghrelin-related peptides have become essential tools for investigating energy balance at the molecular level.',
      'In immunology, antimicrobial peptides and cytokine-modulating sequences are studied for their roles in innate and adaptive immunity. Thymosin alpha-1 and LL-37 are among the most extensively characterized immunomodulatory peptides in the literature. Neuroscience research employs neuropeptides — including substance P, neuropeptide Y, and orexin — to map signaling pathways involved in pain, sleep, anxiety, and reward.',
      'Dermatological and tissue repair research leverages growth factor peptides (such as GHK-Cu and BPC-related sequences) to study wound healing, collagen synthesis, and angiogenesis. Across all these fields, bioactive peptides offer a level of target specificity that enables clean experimental designs and clearly attributable outcomes.',
    ],
  },
  {
    icon: Library,
    title: 'The Growing Library of Characterized Sequences',
    content: [
      'The number of characterized bioactive peptide sequences has expanded dramatically over the past two decades. Public databases such as BIOPEP-UWM, PeptideAtlas, and the Antimicrobial Peptide Database (APD) now catalog tens of thousands of sequences with documented bioactivity, target receptor information, and structure-activity relationships.',
      'Advances in high-throughput screening, phage display, and computational peptide design have accelerated the discovery pipeline. Machine learning models trained on known peptide-receptor interactions can now predict bioactivity from sequence data alone, guiding the synthesis of novel analogues with optimized binding profiles.',
      'This expanding library represents a growing toolkit for researchers. Each newly characterized sequence adds to our collective understanding of how amino acid composition, length, charge, hydrophobicity, and secondary structure contribute to biological function — and how these parameters can be engineered to achieve specific research objectives.',
    ],
  },
]

export default function BioactivePeptidesPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Hero */}
      <div className="mb-12">
        <p className="text-brand-400 text-sm font-medium uppercase tracking-widest mb-3">
          Peptide Science
        </p>
        <h1 className="text-4xl font-bold mb-4">Bioactive Peptides</h1>
        <p className="text-white/50 text-lg leading-relaxed">
          What makes a peptide bioactive, where they come from, how they work, and why
          they matter for modern research.
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
          Definition
        </p>
        <p className="text-white/80 text-lg leading-relaxed">
          A bioactive peptide is a short amino acid sequence that produces a specific, measurable
          biological effect — whether through receptor binding, enzyme modulation, membrane
          interaction, or gene expression regulation. Bioactivity distinguishes functional signaling
          peptides from inert protein fragments.
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
            Bioactive peptides are not synthetic inventions — they are naturally occurring signaling
            molecules that research has learned to isolate, characterize, and reproduce with
            laboratory precision.
          </p>
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
            href="/peptides-benefits"
            className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
          >
            Research Applications &rarr;
          </Link>
          <Link
            href="/blog/marine-peptides"
            className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
          >
            Blog: Marine Peptides &rarr;
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
