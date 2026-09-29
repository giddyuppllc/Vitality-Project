import type { Metadata } from 'next'
import { FlaskConical, Dna, Brain, Sparkles, Zap } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Research — The Vitality Project',
  description: 'An overview of the research landscape surrounding peptides and performance compounds.',
}

const areas = [
  {
    icon: Zap,
    title: 'Tissue Repair & Recovery',
    body: `A significant body of preclinical research has examined synthetic peptides derived from naturally occurring growth factors and body-protective proteins. Studies published in peer-reviewed journals have investigated mechanisms related to tendon and ligament fibroblast activity, gastrointestinal mucosal integrity, and angiogenesis. Compounds in this category have shown activity in rodent models across a range of connective tissue contexts.`,
  },
  {
    icon: Dna,
    title: 'Body Composition & Metabolic Research',
    body: `Growth hormone secretagogues and GHRH analogues represent an active area of endocrinology research. Academic interest centers on pulsatile GH release patterns, IGF-1 axis modulation, and downstream effects on lean mass, adipose tissue, and insulin sensitivity. This research area has historically attracted both pharmaceutical and academic investigation.`,
  },
  {
    icon: Sparkles,
    title: 'Cellular Longevity & Skin Biology',
    body: `Tripeptide-copper complexes occur naturally in human plasma and have been studied extensively for their role in extracellular matrix remodeling, collagen biosynthesis stimulation, and antioxidant enzyme upregulation. Research interest spans wound healing biology, dermatology, and hair follicle science. Independent groups have published findings across multiple tissue types.`,
  },
  {
    icon: Brain,
    title: 'Neuromodulation & Cognitive Research',
    body: `Anxiolytic peptides with tuftsin-derived structures have been studied primarily in Eastern European research institutions for their modulation of GABAergic and serotonergic pathways. Research applications have explored anxiety-related behavioral models, working memory paradigms, and immune-neurological crosstalk without the sedative profiles associated with classical anxiolytics.`,
  },
]

export default function ResearchPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-12">
        <p className="text-brand-400 text-sm font-medium uppercase tracking-widest mb-3">The Science</p>
        <h1 className="text-4xl font-bold mb-4">Research Landscape</h1>
        <p className="text-white/50 text-lg leading-relaxed">
          An overview of the academic and preclinical research areas our product catalog supports. All information below is derived from published scientific literature and is presented for educational purposes only.
        </p>
      </div>

      {/* Disclaimer */}
      <div className="glass rounded-xl p-5 mb-10 border border-brand-500/20">
        <div className="flex gap-3">
          <FlaskConical className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
          <p className="text-sm text-white/50 leading-relaxed">
            The information on this page describes the general research landscape and is not a claim that any product prevents, treats, or cures any condition. All products are sold for research use only and are not approved for human use by the FDA or any other regulatory body.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {areas.map((area) => (
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

      <div className="mt-10 glass rounded-2xl p-8 text-center">
        <h2 className="text-xl font-bold mb-2">Certificate of Analysis</h2>
        <p className="text-white/50 text-sm leading-relaxed max-w-md mx-auto">
          Third-party CoA documentation is available for all products upon request. Contact us after placing your order.
        </p>
      </div>
    </div>
  )
}
