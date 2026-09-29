/**
 * Clubhouse starter content (written 09-29, original). General wellness only:
 * training, nutrition, sleep, recovery, mindset, community. No product,
 * price, dosing or supplier text. Loaded by scripts/seed-vip-clubhouse.ts
 * (production, insert-only) and scripts/vip/seed-dev.ts (throwaway DB).
 */
import { COURSES } from './starter-courses'

export { COURSES }

export const SPACES = [
  { slug: 'announcements', name: 'Announcements', adminOnly: true, sortOrder: 0, description: 'News from the Vitality team: new courses, live-session dates and Clubhouse updates.' },
  { slug: 'introductions', name: 'Introductions', adminOnly: false, sortOrder: 1, description: 'New here? Tell us who you are, what you are training for and what a great year looks like. Then say hello to the member who posted before you.' },
  { slug: 'wins-check-ins', name: 'Wins & Check-ins', adminOnly: false, sortOrder: 2, description: 'The rep, the PR, the eight-hour night, the week you showed up every day. Weekly check-ins live here, and every win counts.' },
  { slug: 'training-lab', name: 'Training Lab', adminOnly: false, sortOrder: 3, description: 'Programming, technique and progress. Share your split, ask for form feedback and compare notes on what is moving the needle.' },
  { slug: 'fuel-nutrition', name: 'Fuel & Nutrition', adminOnly: false, sortOrder: 4, description: 'Protein targets, meal prep, hydration and eating for performance. Real plates from real kitchens.' },
  { slug: 'sleep-recovery', name: 'Sleep & Recovery', adminOnly: false, sortOrder: 5, description: 'Wind-down routines, sleep data, mobility, deloads and rest days done right.' },
  { slug: 'longevity-reads', name: 'Longevity Reads', adminOnly: false, sortOrder: 6, description: 'Books, papers, podcasts and articles worth your time — posted with the one takeaway you would put into practice.' },
  { slug: 'ask-the-coaches', name: 'Ask the Coaches', adminOnly: false, sortOrder: 7, description: 'Questions for Kevin and the Vitality team. Great questions from here are answered live at the monthly Q&A.' },
] as const

export const WELCOME_POST_MARKER = 'Welcome to the Vitality Project Clubhouse.'
export const GUIDELINES_POST_MARKER = 'Clubhouse Guidelines — the short version.'

export const TEAM_POSTS = [
  {
    marker: WELCOME_POST_MARKER,
    body: `Welcome to the Vitality Project Clubhouse.

This is the room for members who take their health seriously and like doing it in good company. Here is how to make it yours this week:

1. Introduce yourself in Introductions — what you are training for and what a great year looks like.
2. Open Clubhouse Orientation in the Classroom. Ten minutes, and everything else gets easier.
3. RSVP to the next live session on the Events page. Kevin answers member questions live every month.
4. Post a check-in in Wins & Check-ins once a week. Small wins, stacked, become big ones.

Your monthly store credit lands on the 1st and applies at vitalityproject.global checkout. Read the Guidelines once, then jump in.

Be vital,
The Vitality Team`,
  },
  {
    marker: GUIDELINES_POST_MARKER,
    body: `Clubhouse Guidelines — the short version.

1. Lead with respect. Challenge ideas, support people.
2. Share experience, not prescriptions. Medical questions belong with your own healthcare provider.
3. Stay on the mission: training, nutrition, sleep, recovery, mindset and longevity.
4. Keep the Clubhouse private. What members share here stays here.
5. Keep it real. Honest numbers, honest progress, sources for research.
6. Share, don't sell. Moderators remove sales pitches and referral links.
7. Report, don't react. The team reviews every report.

The full version lives at https://vitalityproject.vip/guidelines — thanks for making this the best room in your week.`,
  },
] as const

/** Monthly event series. First dates are computed relative to the seed run. */
export const EVENTS = [
  {
    key: 'qa',
    title: 'Live Q&A with Kevin',
    minTier: 'CLUB' as const,
    durationMin: 60,
    // first Thursday of the month, 7:00 pm (vip.timeZone)
    rule: { nth: 1, weekday: 4, hour: 19, minute: 0 },
    description: `Kevin answers member questions live — training, recovery, sleep, nutrition and whatever you are working through this month.

Drop your question in Ask the Coaches ahead of time so Kevin can prepare a great answer, or bring it to the call. Cameras optional, notebooks encouraged.`,
  },
  {
    key: 'kickoff',
    title: 'New Member Kickoff',
    minTier: 'CLUB' as const,
    durationMin: 45,
    // second Wednesday of the month, 7:30 pm
    rule: { nth: 2, weekday: 3, hour: 19, minute: 30 },
    description: `Your first 45 minutes in the Clubhouse, live. A quick tour, how to get the most from the Classroom and Events, how your monthly credit works, and a round of introductions.

Bring one goal for the next 90 days. You will leave with a first-week plan built around it.`,
  },
  {
    key: 'roundtable',
    title: 'Premium Stacks Roundtable',
    minTier: 'PREMIUM' as const,
    durationMin: 60,
    // third Tuesday of the month, 8:00 pm
    rule: { nth: 3, weekday: 2, hour: 20, minute: 0 },
    description: `A small-group call for Premium Stacks members. Progress check-ins on the 12-Week Performance Reset, a hot-seat session on one member's plan each month, and an open floor for your questions.

Come with this week's scorecard and one thing you want to solve.`,
  },
] as const
