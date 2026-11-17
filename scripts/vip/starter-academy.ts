/**
 * Academy starter content (vip/academy, 11-17): learning paths and one
 * research-literacy course with module checks. Original copy. Research
 * literacy and general wellness only — how to read a study and a certificate
 * of analysis — never product use, amounts or medical advice.
 *
 * Inserted by scripts/vip/seed-core.ts, insert-only like everything else.
 * Paths with no published course are not shown to members, so the research
 * category paths can be filled in by the team over time.
 */

export interface StarterTrack {
  slug: string
  title: string
  summary: string
  category: 'FOUNDATIONS' | 'RESEARCH' | 'HEALTH' | 'FITNESS' | 'LIFESTYLE'
  sortOrder: number
}

export const TRACKS: StarterTrack[] = [
  { slug: 'foundations', title: 'Foundations', category: 'FOUNDATIONS', sortOrder: 0, summary: 'Start here: how the Clubhouse works and the weekly rhythm everything else builds on.' },
  { slug: 'research-literacy', title: 'Research Literacy', category: 'RESEARCH', sortOrder: 1, summary: 'Read a study, a certificate of analysis and a purity claim with a clear, critical eye.' },
  { slug: 'repair-recovery', title: 'Repair & Recovery', category: 'RESEARCH', sortOrder: 2, summary: 'The research landscape around tissue repair and recovery, explained at the level of mechanisms and evidence.' },
  { slug: 'body-composition', title: 'Body Composition', category: 'RESEARCH', sortOrder: 3, summary: 'What the research says about metabolism and body composition — and how strong that evidence really is.' },
  { slug: 'longevity-aesthetics', title: 'Longevity & Aesthetics', category: 'RESEARCH', sortOrder: 4, summary: 'Ageing biology and skin science, from cellular mechanisms to what the studies can and cannot show.' },
  { slug: 'neuro-mood', title: 'Neuro & Mood', category: 'RESEARCH', sortOrder: 5, summary: 'Focus, mood and the nervous system: the research questions, the methods and the open debates.' },
  { slug: 'health', title: 'Sleep, Fuel & Recovery', category: 'HEALTH', sortOrder: 6, summary: 'The everyday foundations — sleep, nutrition and recovery — that every other result depends on.' },
  { slug: 'fitness', title: 'Training & Performance', category: 'FITNESS', sortOrder: 7, summary: 'Structured programs that build strength, conditioning and the consistency to keep both.' },
  { slug: 'lifestyle', title: 'Lifestyle & Mindset', category: 'LIFESTYLE', sortOrder: 8, summary: 'Habits, stress, focus and the routines that make a healthy life the easy default.' },
]

/** Which path a starter course (scripts/vip/starter-courses.ts) is filed under when it is first created. */
export const COURSE_TRACK: Record<string, string> = {
  'clubhouse-orientation': 'foundations',
  foundations: 'health',
  'performance-reset': 'fitness',
  'reading-the-research': 'research-literacy',
}

export interface StarterQuestion {
  prompt: string
  options: string[]
  correctIndex: number
  explanation: string
}
export interface StarterAcademyModule {
  title: string
  lessons: Array<{ title: string; minutes: number; body: string }>
  quiz: { title: string; passPct: number; questions: StarterQuestion[] }
}
export interface StarterAcademyCourse {
  slug: string
  title: string
  summary: string
  minTier: 'CLUB' | 'PLUS' | 'PREMIUM'
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  sortOrder: number
  modules: StarterAcademyModule[]
}

const readingTheResearch: StarterAcademyCourse = {
  slug: 'reading-the-research',
  title: 'Reading the Research',
  summary: 'How to judge a study, a headline and a certificate of analysis for yourself — the research-literacy skills behind everything else in the Academy.',
  minTier: 'CLUB',
  level: 'BEGINNER',
  sortOrder: 5,
  modules: [
    {
      title: 'Reading a study',
      lessons: [
        {
          title: 'What kind of study is this?',
          minutes: 7,
          body: `Before you ask whether a study is right, ask what kind of study it is. The design decides how much weight the result can carry.

## The ladder of evidence

- **Cell and lab studies** show that something *can* happen in a dish. They are where ideas start, not where they are proven.
- **Animal studies** add a living system, but bodies differ — many results never carry over to people.
- **Observational studies** follow people and look for patterns. They can show that two things travel together, not that one causes the other.
- **Randomised controlled trials** assign people to groups by chance, which is the strongest way to test cause and effect.
- **Systematic reviews and meta-analyses** pool many trials and are only as good as the studies inside them.

## Your one action

Next time you read a claim, find the study and write down its design in one line. You will be surprised how often a confident headline rests on a single lab result.`,
        },
        {
          title: 'Effect sizes, not headlines',
          minutes: 8,
          body: `"Doubles the effect" can mean a jump from one in a million to two in a million. Headlines love relative numbers; decisions need absolute ones.

## Three numbers to look for

1. **Absolute change** — how big the difference was in real units, not just as a percentage of something small.
2. **Sample size** — ten participants and ten thousand participants are different worlds. Small studies swing wildly by chance.
3. **The confidence interval** — the range the true effect probably sits in. A wide interval that crosses zero means the study could not tell an effect from no effect.

## Statistically significant is not the same as important

A p-value under 0.05 says the result is unlikely to be pure chance under the study's assumptions. It says nothing about whether the effect is large enough to matter to you.

## Your one action

Take one study you have seen quoted and find the absolute difference between the groups. Write it next to the headline and compare.`,
        },
        {
          title: 'Who ran it, who paid, who checked',
          minutes: 6,
          body: `Good science is open about how it was done. A few minutes of checking context tells you how far to trust the conclusion.

## Questions worth asking

- **Was it peer reviewed?** Preprints and conference abstracts have not been checked by independent reviewers yet.
- **Was it registered in advance?** A pre-registered trial states its main outcome before the data arrive, which makes cherry-picking much harder.
- **Who funded it?** Funding does not make a result wrong, but it is a reason to look harder at the design and the outcome chosen.
- **Has anyone repeated it?** One study is a signal. Independent replication is what turns a signal into knowledge.

## Your one action

For the next study that excites you, check whether it was registered and whether anyone has replicated it. Bring what you find to the Ask the Coaches space.`,
        },
      ],
      quiz: {
        title: 'Reading a study',
        passPct: 67,
        questions: [
          {
            prompt: 'Which design is the strongest single test of cause and effect?',
            options: ['A large observational study', 'A randomised controlled trial', 'A cell study with a dramatic result', 'An expert opinion piece'],
            correctIndex: 1,
            explanation: 'Random assignment balances the groups by chance, so a difference between them is far more likely to come from the thing being tested.',
          },
          {
            prompt: 'A risk falls from 2 in 10,000 to 1 in 10,000. How is the change best described?',
            options: ['A 50% relative reduction, and a tiny absolute one', 'A 50% absolute reduction', 'No change at all', 'A large absolute reduction'],
            correctIndex: 0,
            explanation: 'Halving a very small risk is a 50% relative change but only 1 in 10,000 in absolute terms — the number that matters for decisions.',
          },
          {
            prompt: 'What does pre-registering a trial protect against?',
            options: ['Small sample sizes', 'Funding bias', 'Choosing the outcome after seeing the data', 'Peer review delays'],
            correctIndex: 2,
            explanation: 'Stating the main outcome in advance makes it much harder to report whichever measure happened to look best.',
          },
        ],
      },
    },
    {
      title: 'Purity and testing',
      lessons: [
        {
          title: 'What a certificate of analysis tells you',
          minutes: 8,
          body: `A certificate of analysis — a CoA — is a laboratory's report on one specific batch of material. Read it like a receipt: every line should match what you have in front of you.

## The parts that matter

- **The laboratory** — named, with contact details, ideally independent of the seller.
- **The batch or lot number** — this must match the lot on the label. A CoA for a different lot tells you nothing about yours.
- **The test date** — recent and consistent with when the batch was made.
- **The method** — for example HPLC for purity or mass spectrometry for identity. A result without a method is a number without meaning.
- **The result against the specification** — what was measured and what the acceptable range was.

## Your one action

Open any CoA on vitalityproject.global and find those five things. If one of them is missing on a document you meet elsewhere, treat that as a question to ask.`,
        },
        {
          title: 'Purity percentages and their limits',
          minutes: 7,
          body: `"98% pure" is useful, and it is also narrower than it sounds. Knowing what a purity figure measures keeps you from reading more into it than it says.

## What the number usually means

On an HPLC report, purity is typically the share of the measured signal that belongs to the target compound. It tells you how much of what the instrument detected was the thing you wanted.

## What it does not tell you on its own

- **Identity** — that the main peak really is the target needs a separate confirmation, usually mass spectrometry.
- **Contaminants the method cannot see** — such as microbial contamination or endotoxins, which need their own tests.
- **Quantity** — purity is a proportion, not an amount.

## Your one action

When you see a purity figure, ask two follow-up questions: how was identity confirmed, and which other tests were run? A good supplier answers both without hesitation.`,
        },
        {
          title: 'Third-party testing and red flags',
          minutes: 6,
          body: `Independent testing is only reassuring when the paperwork holds together. Most problems show up as small inconsistencies rather than dramatic ones.

## Signs of a trustworthy report

- An independent lab you can look up, with the report traceable to it.
- A lot number, date and method that all line up with the product.
- Results shown in full, chromatograms included, not just a pass stamp.

## Red flags

- Lot numbers that do not match, or one report used for every batch.
- Dates that are years old, edited or missing.
- Redacted lab names or methods, or a document that exists only as a cropped image.
- Results that are suspiciously perfect, every time.

## Your one action

Pick one certificate and check it against this list. Share anything confusing in Ask the Coaches — reading these together is how everyone gets sharper.`,
        },
      ],
      quiz: {
        title: 'Purity and testing',
        passPct: 67,
        questions: [
          {
            prompt: 'A certificate shows a different lot number from the label in front of you. What does it tell you about your batch?',
            options: ['Everything — lots are interchangeable', 'Nothing about your batch', 'Only its purity', 'Only its identity'],
            correctIndex: 1,
            explanation: 'A CoA describes the batch that was tested. Without a matching lot number it says nothing about the material you have.',
          },
          {
            prompt: 'An HPLC purity figure on its own does NOT confirm…',
            options: ['How much of the detected signal is the target', 'That the main peak really is the target compound', 'That a method was used', 'That a lab ran the test'],
            correctIndex: 1,
            explanation: 'Identity needs separate confirmation, usually by mass spectrometry. HPLC purity is a proportion of what the instrument detected.',
          },
          {
            prompt: 'Which of these is a red flag on a testing report?',
            options: ['A named, independent laboratory', 'A method listed next to each result', 'The same report used for every batch', 'A recent test date'],
            correctIndex: 2,
            explanation: 'Each batch should have its own report. One document reused across batches cannot describe all of them.',
          },
        ],
      },
    },
  ],
}

export const ACADEMY_COURSES: StarterAcademyCourse[] = [readingTheResearch]
