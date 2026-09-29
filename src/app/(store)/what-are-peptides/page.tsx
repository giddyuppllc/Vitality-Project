import type { Metadata } from 'next'
import Link from 'next/link'
import { FlaskConical, ChevronDown } from 'lucide-react'

export const metadata: Metadata = {
  title: 'What Are Peptides? The Biological Blueprint — The Vitality Project',
  description:
    'What are peptides and how do they work? Explore the biological blueprint of peptides, including structure, function, safety, legality, and research applications.',
}

const faqItems = [
  {
    q: 'What exactly are peptides?',
    a: 'Peptides are short chains of amino acids, typically between 2 and 50 residues in length, linked by peptide bonds. They function as biological signaling molecules, carrying instructions that regulate processes such as metabolism, immune response, tissue repair, and hormone secretion. Unlike large proteins, peptides are compact enough to interact with specific receptor targets with high precision.',
  },
  {
    q: 'How are peptides different from proteins?',
    a: 'The primary distinction is size and complexity. Peptides are generally defined as chains of fewer than 50 amino acids, while proteins are longer chains that fold into complex three-dimensional structures. Peptides tend to act as signaling molecules or modulators, while proteins serve broader structural and enzymatic roles. In research contexts, peptides are valued for their specificity and ease of synthesis.',
  },
  {
    q: 'Are peptides natural or synthetic?',
    a: 'Both. The human body produces hundreds of endogenous peptides that regulate critical biological functions — from insulin (a peptide hormone) to endorphins (neuropeptides). Research-grade peptides are synthesized in laboratories using Solid-Phase Peptide Synthesis (SPPS) to replicate these natural sequences with high purity, typically exceeding 98%.',
  },
  {
    q: 'What are research peptides used for?',
    a: 'Research peptides are used in preclinical and in vitro studies across a wide range of disciplines including endocrinology, immunology, neuroscience, dermatology, and metabolic research. They allow investigators to study receptor-ligand interactions, signaling pathways, and biological mechanisms with a level of specificity that broader compounds cannot achieve.',
  },
  {
    q: 'Are peptides safe?',
    a: 'Peptides used in research settings are manufactured under strict quality controls and tested by independent third-party laboratories. Because they are modeled on naturally occurring biological sequences, they are generally well-characterized in the scientific literature. However, all research compounds should be handled according to standard laboratory safety protocols. Products sold by The Vitality Project are for research use only.',
  },
  {
    q: 'Are peptides legal to purchase?',
    a: 'Yes. Research-grade peptides sold for in vitro laboratory use are legal to purchase in the United States. They are classified as Research Use Only (RUO) compounds and are not approved for human consumption, clinical diagnosis, or therapeutic application. Buyers are responsible for ensuring their use complies with applicable local, state, and federal regulations.',
  },
  {
    q: 'How should research peptides be stored?',
    a: 'Most research peptides are supplied in lyophilized (freeze-dried) powder form and should be stored in a cool, dry environment — ideally refrigerated at 2–8°C or frozen at -20°C for long-term storage. Once reconstituted, peptides should be used promptly or stored according to the specific compound guidelines. Proper storage ensures maximum stability and integrity of the compound.',
  },
]

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqItems.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.a,
    },
  })),
}

function FaqCard({ q, a }: { q: string; a: string }) {
  return (
    <details className="glass rounded-2xl group">
      <summary className="p-6 cursor-pointer flex items-center justify-between gap-4 list-none [&::-webkit-details-marker]:hidden">
        <h3 className="font-semibold">{q}</h3>
        <ChevronDown className="w-5 h-5 text-white/40 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-6 pb-6 -mt-2">
        <p className="text-white/60 text-sm leading-relaxed">{a}</p>
      </div>
    </details>
  )
}

export default function WhatArePeptidesPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Hero */}
      <div className="mb-12">
        <p className="text-brand-400 text-sm font-medium uppercase tracking-widest mb-3">
          Peptide Science
        </p>
        <h1 className="text-4xl font-bold mb-4">The Biological Blueprint of Peptides</h1>
        <p className="text-white/50 text-lg leading-relaxed">
          A Science-Based Foundation for Modern Research, Signaling, and Precision Biology
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

      {/* Featured Definition */}
      <div className="glass rounded-2xl p-8 mb-10 border border-brand-500/20">
        <p className="text-brand-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Definition
        </p>
        <p className="text-white/80 text-lg leading-relaxed">
          Peptides are short chains of amino acids that function as biological signaling molecules,
          regulating processes such as metabolism, cellular repair, hormone activity, and immune
          response by binding to specific receptors in the body.
        </p>
      </div>

      {/* Content Sections */}
      <div className="space-y-8">
        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-3">The Biological Blueprint</h2>
          <p className="text-white/60 leading-relaxed">
            Every biological process in the body — from wound healing to sleep regulation — is
            governed by molecular instructions. Peptides are a critical layer of that instruction
            system. They do not force change the way many synthetic compounds do; instead, they
            communicate with receptor sites that already exist, triggering cascades that the body is
            designed to execute. Think of peptides not as drugs, but as biological software: compact
            sequences of amino acids that carry specific messages to specific targets. The body
            already produces thousands of these signaling molecules. Research-grade peptides
            replicate those sequences with laboratory precision, enabling investigators to study
            their mechanisms in controlled environments.
          </p>
        </div>

        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-3">From Amino Acids to Biological Signals</h2>
          <p className="text-white/60 leading-relaxed mb-4">
            All peptides are composed of amino acids — the 20 standard building blocks used across
            all forms of life. Each amino acid has a unique side chain that determines its chemical
            properties: some are hydrophobic, others polar, acidic, or basic. When amino acids are
            linked together in a specific order through peptide bonds, the resulting chain folds and
            interacts with its environment in ways dictated entirely by that sequence.
          </p>
          <p className="text-white/60 leading-relaxed">
            A change of even a single amino acid in a peptide sequence can radically alter its
            function — redirecting it to a different receptor, changing its binding affinity, or
            modifying its half-life in biological systems. This is why sequence specificity is the
            defining characteristic of peptide science: the order of the residues is the message
            itself.
          </p>
        </div>

        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-3">Natural Origin: The Language of Life</h2>
          <p className="text-white/60 leading-relaxed mb-4">
            Peptides are not a recent invention. They are one of the oldest and most conserved
            signaling systems in biology. The human body produces hundreds of endogenous peptides —
            from insulin and oxytocin to antimicrobial defensins and neuropeptide Y. These molecules
            regulate hunger, mood, healing, immune defense, and cellular turnover every second of
            every day.
          </p>
          <p className="text-white/60 leading-relaxed">
            Beyond human biology, peptides are found across all kingdoms of life. Plants produce
            peptide hormones that regulate growth and defense. Marine organisms such as cone snails
            produce venom peptides with extraordinary receptor specificity, several of which have
            informed pharmaceutical research. Fungal and microbial peptides have been studied for
            their antimicrobial and immunomodulatory properties. Peptide signaling is, quite
            literally, a universal biological language.
          </p>
        </div>

        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-3">From Nature to Laboratory Synthesis</h2>
          <p className="text-white/60 leading-relaxed mb-4">
            Modern research peptides are manufactured using Solid-Phase Peptide Synthesis (SPPS), a
            method developed by Nobel laureate Bruce Merrifield in 1963. SPPS builds the peptide
            chain one amino acid at a time on a solid resin support, allowing precise control of
            sequence, purity, and yield. After synthesis, peptides are cleaved from the resin,
            purified using high-performance liquid chromatography (HPLC), and verified through mass
            spectrometry.
          </p>
          <p className="text-white/60 leading-relaxed">
            This process enables the production of peptide sequences identical to those found in
            nature — as well as novel analogues designed to improve stability, receptor affinity, or
            bioavailability. Research-grade peptides typically meet or exceed 98% purity standards,
            with independent third-party Certificates of Analysis documenting each batch.
          </p>
        </div>

        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-3">Structure Determines Function</h2>
          <p className="text-white/60 leading-relaxed mb-4">
            A peptide&apos;s primary structure — its linear amino acid sequence — is the foundation
            of its biological activity. But function is not determined by sequence alone. Many
            peptides adopt secondary structures such as alpha-helices, beta-turns, or random coils
            that are critical for receptor recognition and binding.
          </p>
          <p className="text-white/60 leading-relaxed">
            When a peptide encounters its target receptor, it fits into the binding pocket with
            geometric precision — a relationship often described as &quot;lock and key&quot; or, more
            accurately, &quot;induced fit.&quot; This binding event triggers a conformational change
            in the receptor, initiating an intracellular signaling cascade. The specificity of this
            interaction is what makes peptides such powerful research tools: they can activate a
            single pathway without the broad off-target effects associated with many small-molecule
            compounds.
          </p>
        </div>

        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-3">Peptides vs Proteins</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
            <div>
              <p className="text-brand-400 text-sm font-semibold mb-2">Peptides</p>
              <ul className="text-white/60 text-sm leading-relaxed space-y-1.5">
                <li>• 2–50 amino acids in length</li>
                <li>• Typically act as signaling molecules</li>
                <li>• Compact and receptor-specific</li>
                <li>• Easier to synthesize and modify</li>
                <li>• Rapid onset, shorter half-life</li>
              </ul>
            </div>
            <div>
              <p className="text-brand-400 text-sm font-semibold mb-2">Proteins</p>
              <ul className="text-white/60 text-sm leading-relaxed space-y-1.5">
                <li>• 50+ amino acids, often hundreds</li>
                <li>• Structural, enzymatic, and transport roles</li>
                <li>• Complex 3D folding required for function</li>
                <li>• Difficult and expensive to synthesize</li>
                <li>• Longer biological persistence</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-3">Why This Matters</h2>
          <p className="text-white/60 leading-relaxed">
            The shift toward peptide-based research represents a broader movement in biology: from
            blunt interventions to precision signaling. Rather than flooding a system with a broad
            compound and managing side effects, peptide research explores how targeted molecular
            messages can activate specific pathways with minimal disruption. This approach has
            implications for every major area of biological inquiry — from metabolic research and
            tissue repair to neuromodulation and immune regulation. As synthesis technology advances
            and our understanding of receptor biology deepens, peptides are poised to become an
            increasingly central tool in the research landscape.
          </p>
        </div>

        {/* Core Principle Block */}
        <div className="rounded-2xl p-8 bg-brand-500/10 border border-brand-500/30">
          <p className="text-brand-400 text-xs font-semibold uppercase tracking-widest mb-3">
            Core Principle
          </p>
          <p className="text-gray-900/90 text-lg leading-relaxed font-medium">
            Peptides are not foreign compounds. They are biological instructions written in the
            body&apos;s native language.
          </p>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="mt-16">
        <h2 className="text-2xl font-bold mb-2">Frequently Asked Questions</h2>
        <p className="text-white/50 text-sm mb-8">
          Common questions about peptides, their function, legality, and research applications.
        </p>
        <div className="space-y-3">
          {faqItems.map((item) => (
            <FaqCard key={item.q} q={item.q} a={item.a} />
          ))}
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
            href="/peptides-safety"
            className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
          >
            Peptide Safety &amp; Quality Standards &rarr;
          </Link>
          <Link
            href="/blog/glp1-peptides"
            className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
          >
            Blog: GLP-1 Peptides &rarr;
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
