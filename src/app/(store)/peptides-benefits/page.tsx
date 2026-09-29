import type { Metadata } from 'next'
import Link from 'next/link'
import { FlaskConical, Zap, Dna, Sparkles, Brain, ShieldCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Research Applications of Peptides — The Vitality Project',
  description:
    'Explore the key research areas where peptides are being studied, including tissue repair, metabolic research, cellular longevity, neuromodulation, and immune modulation.',
}

const researchAreas = [
  {
    icon: Zap,
    title: 'Tissue Repair & Recovery Research',
    body: 'Preclinical studies have investigated the role of synthetic peptides in connective tissue remodeling, fibroblast proliferation, and angiogenesis. Peptides derived from naturally occurring growth factors and body-protective compounds have been examined in rodent models for their effects on tendon, ligament, and gastrointestinal mucosal integrity. This area of research is particularly active in sports medicine and orthopedic biology, where investigators seek to understand the molecular mechanisms underlying tissue regeneration and structural recovery.',
  },
  {
    icon: Dna,
    title: 'Body Composition & Metabolic Studies',
    body: 'Growth hormone secretagogues, GHRH analogues, and GLP-1 receptor agonists represent some of the most extensively studied peptide categories in metabolic research. Academic interest centers on pulsatile growth hormone release patterns, IGF-1 axis modulation, and downstream effects on lean mass, adipose tissue distribution, and insulin sensitivity. These compounds are studied in preclinical models to better understand the hormonal regulation of energy homeostasis and body composition.',
  },
  {
    icon: Sparkles,
    title: 'Cellular Longevity & Skin Biology',
    body: 'Copper-peptide complexes, such as GHK-Cu, occur naturally in human plasma and have been studied for their role in extracellular matrix remodeling, collagen biosynthesis stimulation, and antioxidant enzyme upregulation. Research interest spans wound healing biology, dermatological science, and hair follicle biology. Separately, peptides related to telomere biology and sirtuins have been investigated in cellular models of aging, exploring mechanisms of senescence and cellular turnover.',
  },
  {
    icon: Brain,
    title: 'Cognitive & Neuromodulatory Research',
    body: 'Several peptide families have been investigated for their interactions with central nervous system receptors. Tuftsin-derived anxiolytic peptides have been studied in behavioral models for modulation of GABAergic and serotonergic pathways without the sedative profiles associated with classical anxiolytics. Other neuropeptides have been examined for their roles in working memory, neuroprotection, and synaptic plasticity in preclinical models.',
  },
  {
    icon: ShieldCheck,
    title: 'Immune Modulation Studies',
    body: 'Thymic peptides such as thymosin alpha-1 and thymulin have been studied for their effects on T-cell maturation, differentiation, and cytokine regulation. Antimicrobial peptides — including defensins and cathelicidins — are an active area of innate immunity research. These compounds are investigated for their ability to modulate immune responses without the broad immunosuppressive effects of conventional approaches, making them valuable tools in immunology research.',
  },
]

export default function PeptidesBenefitsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Hero */}
      <div className="mb-12">
        <p className="text-brand-400 text-sm font-medium uppercase tracking-widest mb-3">
          Research Areas
        </p>
        <h1 className="text-4xl font-bold mb-4">Research Applications of Peptides</h1>
        <p className="text-white/50 text-lg leading-relaxed">
          An overview of the major research domains where peptides are actively studied in
          preclinical and in vitro settings. All content below reflects published scientific
          literature and is presented for educational purposes only.
        </p>
      </div>

      {/* RUO Disclaimer */}
      <div className="glass rounded-xl p-5 mb-10 border border-brand-500/20">
        <div className="flex gap-3">
          <FlaskConical className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
          <p className="text-sm text-white/50 leading-relaxed">
            The research applications described below are based on preclinical and in vitro studies
            published in peer-reviewed journals. Nothing on this page constitutes a medical claim or
            recommendation. All products sold by The Vitality Project are for research use only.
          </p>
        </div>
      </div>

      {/* Research Area Cards */}
      <div className="space-y-6">
        {researchAreas.map((area) => (
          <div key={area.title} className="glass rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                <area.icon className="w-4.5 h-4.5 text-brand-400" />
              </div>
              <h2 className="text-xl font-bold">{area.title}</h2>
            </div>
            <p className="text-white/60 leading-relaxed">{area.body}</p>
          </div>
        ))}
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
            href="/bioactive-peptides"
            className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
          >
            Bioactive Peptides &rarr;
          </Link>
          <Link
            href="/blog/longevity-peptides"
            className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
          >
            Blog: Longevity Peptides &rarr;
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
