/**
 * Public landing copy for vitalityproject.vip (vip/academy redesign).
 *
 * Replaces the 09-29 landing layout; the meaning of the original copy in
 * lib/vip/copy.ts (a private members' clubhouse, coaches in the room, live
 * sessions, monthly credit, join through vitalityproject.global by Zelle) is
 * kept and extended to the whole platform. Every number on the page comes
 * from live data or settings at render time — none is written here.
 * No testimonials, member counts or outcome claims.
 */

export const LANDING = {
  eyebrow: 'Members only · The Vitality Project',
  title: 'Your health, training and learning — in one private clubhouse.',
  intro:
    'The Clubhouse is where Vitality members learn, train and show up for each other. A coached community, an Academy of short courses with certificates, your workouts and daily check-ins, live sessions with the team, and rewards that turn the work into points.',
  ctaJoin: 'See membership levels',
  ctaSignIn: 'Member sign in',

  pillarsKicker: 'One membership, everything inside',
  pillars: {
    community: {
      title: 'A community that shows up',
      body: 'A private feed organised into spaces — training, fuel, sleep, longevity reads and more. Share the work, ask the real question, get a straight answer.',
      points: ['Topic spaces and introductions', 'Member directory and profiles', 'Team announcements and live replies'],
    },
    academy: {
      title: 'The Academy',
      body: 'Learning paths from foundations to research literacy — how to read a study, what a certificate of analysis tells you, how to judge a purity claim — plus health, fitness and lifestyle tracks.',
      points: ['Short video lessons with written companions', 'Module checks, private notes and resume', 'A verifiable certificate for every course'],
    },
    training: {
      title: 'Training & daily health',
      body: 'Your program, your workout log and a one-minute daily check-in on sleep, training, fuel and mood — so progress is something you can see.',
      points: ['Workout programs and logging', 'Habits and challenges', 'Daily check-ins'],
    },
    rewards: {
      title: 'Rewards & partners',
      body: 'Learning and showing up earn points in one balance with your vitalityproject.global account. Spend them on products, merch and trainings, and across the partner network.',
      points: ['Points for lessons, courses and module checks', 'Redeem for products, merch and trainings', 'Monthly store credit by level'],
    },
  },

  liveTitle: 'Live, on camera, every month',
  liveBody:
    'Live Q&As with Kevin and the coaches, workshops, workout classes and office hours. RSVP for reminders, add them to your calendar, and catch the recording in the Library if you miss one.',

  compareKicker: 'Membership',
  compareTitle: 'Choose your level',
  compareIntro: 'Every level opens the Clubhouse. Higher levels open more of the Academy, more live time and more credit every month.',
  compareNote: 'Billed monthly by Zelle through vitalityproject.global. Change or cancel your level anytime.',

  stepsTitle: 'How joining works',

  guardrailTitle: 'Education, framed responsibly',
  guardrailBody:
    'Academy content is research literacy and general fitness, nutrition and lifestyle education. It is not medical advice and never tells anyone how to use a product — your own healthcare provider knows your history.',

  closingTitle: 'Your next level starts with a single check-in.',
  closingBody: 'Pick a level, confirm at vitalityproject.global, and we will see you inside.',
}

export const LANDING_FAQ_EXTRA = [
  {
    q: 'What is in the Academy?',
    a: 'Learning paths made of short lessons — video plus a written companion and downloadable resources — with a quick check at the end of each module. Finish a course and you get a certificate with a verification ID anyone can check.',
  },
  {
    q: 'How do points work?',
    a: 'Completing lessons, passing module checks and finishing courses earns points in the same balance as your vitalityproject.global account (100 points = $1). Spend them on products, merch and trainings.',
  },
  {
    q: 'Can I add a training my level does not include?',
    a: 'Yes. Some trainings can be unlocked on their own — with points, or with one Zelle payment through vitalityproject.global — and stay yours whatever your level.',
  },
  {
    q: 'Is there an app?',
    a: 'The Clubhouse installs to your phone’s home screen straight from the browser — full screen, one tap away, no app store needed.',
  },
]
