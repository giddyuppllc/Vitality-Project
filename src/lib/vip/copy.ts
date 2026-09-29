/**
 * Clubhouse copy — vitalityproject.vip.
 *
 * Written 09-29 under Edward's instruction to finish the clubhouse with
 * original, on-brand copy ("fill in blanks, build unique awesome data at
 * every line"). Voice: confident, warm, performance-and-longevity lifestyle,
 * short sentences, positive framing. General wellness only — training,
 * nutrition, sleep, recovery, mindset, community. No product, price, dosing
 * or supplier text lives on the clubhouse.
 *
 * Numbers that are settings (monthly credit per tier, expiry months, member
 * discount %) are passed in at render time — never hard-coded in copy.
 */
import type { MembershipTier } from '@prisma/client'

export type PaidTier = 'CLUB' | 'PLUS' | 'PREMIUM'

const usd = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`

export const VIP_COPY = {
  brandLine: 'Be Vital.',

  landing: {
    eyebrow: 'Private members’ clubhouse',
    title: 'Train smarter. Recover deeper. Live longer — together.',
    intro:
      'The Clubhouse is where Vitality members do the work and share the wins. Coaches in the room, a classroom that turns good intentions into daily habits, live sessions every month, and store credit that lands on the 1st. Your membership opens the door.',
    ctaJoin: 'Join the Clubhouse',
    ctaSignIn: 'Member sign in',
    proof: ['Live Q&A every month', 'Courses built in 10-minute lessons', 'Credit on the 1st, every month'],
    featuresTitle: 'Everything inside',
    features: {
      community: {
        title: 'Community',
        body: 'A private feed for check-ins, training logs and honest questions. Post a PR, share your sleep numbers, get a straight answer from people doing the same work.',
      },
      classroom: {
        title: 'Classroom',
        body: 'Structured courses on sleep, training, fuel and recovery. Short lessons, one clear action each, and progress that saves as you go.',
      },
      events: {
        title: 'Live sessions',
        body: 'A monthly live Q&A with Kevin, a kickoff for every new member and a Premium Stacks roundtable. Bring your questions and leave with a plan.',
      },
      rewards: {
        title: 'Monthly rewards',
        body: 'Store credit lands in your Vitality account on the 1st of every month. It applies at vitalityproject.global checkout, on top of your member pricing.',
      },
    },
    tiersTitle: 'Choose your level',
    tiersIntro:
      'Every level opens the Clubhouse. Higher levels open more of the classroom, more live time and more credit every month.',
    stepsTitle: 'How joining works',
    faqTitle: 'Good to know',
    closingTitle: 'Your next level starts with a single check-in.',
    closingBody: 'Pick a level, confirm at vitalityproject.global, and we will see you inside.',
    nonMemberTitle: 'Your account is ready — your membership is next.',
    nonMemberBody:
      'Pick a level and finish at vitalityproject.global. The Clubhouse opens the moment your membership is active, and your welcome email brings you straight back here.',
    pendingTitle: 'Your membership is waiting on its first payment.',
    pendingBody:
      'Send the Zelle payment from your invoice with the order number as the memo. The Clubhouse opens as soon as it is confirmed — usually the same day.',
    footerTagline: 'The Vitality Project Clubhouse — a private community for members.',
  },

  tiers: {
    CLUB: { name: 'The Club', tagline: 'Your seat in the room.' },
    PLUS: { name: 'Plus', tagline: 'The complete foundation.' },
    PREMIUM: { name: 'Premium Stacks', tagline: 'The full program, coached.' },
  } satisfies Record<PaidTier, { name: string; tagline: string }>,

  joinSteps: [
    { title: 'Pick your level', body: 'Choose The Club, Plus or Premium Stacks. You can change levels anytime.' },
    { title: 'Confirm at vitalityproject.global', body: 'Membership lives on your Vitality account. Sign in or create one — your level is already selected.' },
    { title: 'Send one Zelle payment', body: 'The amount and memo appear on screen and in your inbox. Membership activates as soon as the payment is confirmed, usually the same day.' },
    { title: 'Walk in', body: 'Your welcome email brings you straight here. Sign in with the same email and password.' },
  ],

  signin: {
    title: 'Welcome back',
    body: 'Sign in with your Vitality account — the same email and password you use at vitalityproject.global.',
    newHere: 'New here?',
    newHereLink: 'See membership levels',
  },

  empty: {
    feed: { title: 'Quiet in here — for now.', body: 'Start the conversation: share today’s training, a win from this week or the question you have been sitting on.' },
    search: { title: 'Nothing matches that search yet.', body: 'Try a different word, or start the thread yourself.' },
    space: { title: 'This space is ready for its first post.', body: 'Set the tone — a question, a result or a resource you rate.' },
    notifications: { title: 'You’re all caught up.', body: 'Replies, comments on your posts and mentions land here.' },
    members: { title: 'No members match that name.', body: 'Check the spelling, or search by username.' },
    classroom: { title: 'Fresh courses are being recorded.', body: 'New lessons post here first. Until then, bring your questions to the next live session.' },
    events: { title: 'The next sessions are being scheduled.', body: 'New dates post here first. RSVP and we will remind you a day before and an hour before.' },
    rewardsHistory: { title: 'Your first reward lands on the 1st.', body: 'Credit, spending and returns all show up here as they happen.' },
    memberPosts: { title: 'No posts yet.', body: 'When they share, it shows up here.' },
  },

  onboarding: {
    title: 'Start here',
    body: 'Four quick steps to get the most out of your first week.',
    hide: 'Hide checklist',
    steps: [
      { key: 'profile', title: 'Add a photo and a line about your goals', href: '/profile' },
      { key: 'intro', title: 'Say hello in Introductions', href: '/feed?space=introductions' },
      { key: 'course', title: 'Open Clubhouse Orientation', href: '/classroom/clubhouse-orientation' },
      { key: 'event', title: 'RSVP to your next live session', href: '/events' },
    ],
  },

  feed: {
    title: 'Community',
    subtitle: 'Check in, share the work, ask the real questions.',
    composerPlaceholder: 'Share a win, a check-in or a question…',
  },

  classroom: {
    title: 'Classroom',
    intro: 'Short lessons. One clear action each. Your progress saves as you go.',
    lockedLesson: (tierName: string) => `This lesson opens at ${tierName}. Change your level at vitalityproject.global and it unlocks right away.`,
    lockedCourse: (tierName: string) => `Opens at ${tierName}`,
    upgrade: 'Change level at vitalityproject.global',
    wellnessNote:
      'Clubhouse lessons are general wellness education on training, nutrition, sleep and recovery. Check in with your healthcare provider before making big changes to your routine.',
  },

  events: {
    title: 'Events',
    intro: 'Live, on camera, with the people doing the work. RSVP for a reminder a day before and an hour before — join links sit right on each card.',
    requires: 'Opens at',
  },

  rewards: {
    title: 'Rewards',
    intro:
      'On the 1st of every month your membership deposits store credit into your Vitality account. Spend it on anything at vitalityproject.global — it applies at checkout, on top of your member pricing.',
    how: [
      { title: 'It lands on the 1st', body: (monthly: number) => (monthly > 0 ? `${usd(monthly)} arrives on the 1st of each month while your membership is active.` : 'Credit arrives on the 1st of each month while your membership is active.') },
      { title: 'It spends at checkout', body: () => 'Card or Zelle, your credit comes off the order total — shipping and tax included. Cancelled orders return it.' },
      { title: 'It keeps', body: (months: number) => (months > 0 ? `Each month’s credit is good for ${months} months from the day it lands.` : 'Your credit stays in your account until you use it.') },
    ],
    balanceLabel: 'Available credit',
    shopCta: 'Use it at vitalityproject.global',
    expiringTitle: 'Reward credit by expiry date',
    historyTitle: 'History',
    fullHistory: 'Full account history at vitalityproject.global',
  },

  guidelines: {
    title: 'Clubhouse Guidelines',
    intro: 'The Clubhouse works because members show up for each other. These seven guidelines keep it that way.',
    rules: [
      { title: 'Lead with respect', body: 'Challenge ideas, support people. Keep it kind, direct and useful — the way a great training partner would.' },
      { title: 'Share experience, not prescriptions', body: 'Tell members what worked for you and why. Medical questions belong with each member’s own healthcare provider, who knows their history.' },
      { title: 'Stay on the mission', body: 'Training, nutrition, sleep, recovery, mindset and longevity are what we are here for. Order and product questions go to the vitalityproject.global support team.' },
      { title: 'Keep the Clubhouse private', body: 'What members share here stays here. Screenshots, names and personal details stay inside the room.' },
      { title: 'Keep it real', body: 'Honest numbers, honest photos, honest progress. Share what you know firsthand and link your sources for research.' },
      { title: 'Share, don’t sell', body: 'The feed is for training, results and questions. Moderators remove sales pitches and referral links.' },
      { title: 'Report, don’t react', body: 'See something off? Tap Report. The team reviews every report and may hide content or pause posting to keep the room right.' },
    ],
    closing: 'Thanks for making this the best room in your week.',
  },

  privacy: {
    title: 'Clubhouse Privacy',
    intro: 'The Clubhouse is private by design. Here is exactly what we keep, who sees it and the choices you have.',
    sections: [
      { title: 'Who sees what', body: 'Posts, comments, reactions and profiles are visible to signed-in members with an active membership and to the Vitality team. Search engines are told never to index the Clubhouse.' },
      { title: 'What we keep', body: 'Your display name, photo, bio, posts, comments, reactions, event RSVPs, lesson progress and email preferences. Your membership, orders and store credit live on your Vitality account at vitalityproject.global.' },
      { title: 'Photos', body: 'Every image you upload is re-encoded on our servers, which strips camera and GPS details, and is served only to signed-in members.' },
      { title: 'Email', body: 'We send a welcome email, a daily digest when members reply to or mention you, reminders for sessions you RSVP to and a note when your monthly reward lands. Turn any of them off from your profile or from the link in each email.' },
      { title: 'Moderation', body: 'The Vitality team reviews reports and can hide content that falls outside the Guidelines. Hidden content stays on record for the team.' },
      { title: 'Your choices', body: 'Edit or delete your posts and comments anytime. To close your Clubhouse profile, reply to any Clubhouse email or write to vital@vitalityproject.global.' },
    ],
  },

  suspended: {
    title: 'Your community access is paused',
    body: 'Posting and the member feed are paused on your account. Your classroom, events and rewards stay fully open.',
    contact: 'Questions? Reply to any Clubhouse email or write to vital@vitalityproject.global.',
  },

  notFound: { title: 'This page took a rest day.', body: 'The link may have moved. Head back to the Clubhouse and pick up where you left off.' },

  profile: {
    emailTitle: 'Email from the Clubhouse',
    emailIntro: 'Choose what lands in your inbox. Account and order emails from vitalityproject.global are unaffected.',
    emailDigest: ['Daily digest', 'One email a day when members reply to you or mention you.'],
    emailEvents: ['Event reminders', 'A day before and an hour before sessions you RSVP to.'],
    emailRewards: ['Monthly reward notice', 'A short note when your credit lands on the 1st.'],
  },

  emailPage: {
    title: 'Email preferences',
    confirm: (label: string) => `Turn off ${label}?`,
    button: 'Turn it off',
    done: (label: string) => `Saved — ${label}: off. Switch it back on anytime from your Clubhouse profile.`,
    invalid: 'This link has expired or is incomplete. Manage your email from your Clubhouse profile.',
  },

  /** .global /account/membership card (the SSO hand-off into the clubhouse). */
  globalCard: {
    title: 'Enter the Clubhouse',
    body: 'Your members’ community, classroom and live sessions at vitalityproject.vip.',
  },
}

/** Tier card bullets, built from live settings so copy never drifts from reality. */
export function tierBullets(
  tier: PaidTier,
  a: { monthlyCreditCents: number; discountPct: number; freeShipping: boolean },
): string[] {
  const credit = a.monthlyCreditCents > 0 ? `${usd(a.monthlyCreditCents)} store credit on the 1st of every month` : null
  const store = `${a.discountPct}% member pricing${a.freeShipping ? ' and free shipping' : ''} at vitalityproject.global`
  const lists: Record<PaidTier, Array<string | null>> = {
    CLUB: ['The full Clubhouse community and member directory', 'Clubhouse Orientation course', 'Monthly live Q&A with Kevin', credit, store],
    PLUS: ['Everything in The Club', 'Foundations: Sleep, Training, Fuel course', credit, store],
    PREMIUM: ['Everything in Plus', 'The 12-Week Performance Reset', 'Premium Stacks Roundtable every month', credit, store],
  }
  return lists[tier].filter((x): x is string => !!x)
}

export function faq(a: { expiryMonths: number; credits: Record<PaidTier, number> }): Array<{ q: string; a: string }> {
  const amounts = `${usd(a.credits.CLUB)}, ${usd(a.credits.PLUS)} or ${usd(a.credits.PREMIUM)}`
  return [
    {
      q: 'Is the Clubhouse part of my membership?',
      a: 'Yes. Every active Vitality membership includes the Clubhouse. Sign in with the same email and password you use at vitalityproject.global.',
    },
    {
      q: 'How does the monthly credit work?',
      a: `On the 1st of each month, active members receive store credit — ${amounts} by level. It sits in your Vitality account and applies at vitalityproject.global checkout.${a.expiryMonths > 0 ? ` Each month’s credit is good for ${a.expiryMonths} months.` : ''}`,
    },
    {
      q: 'Can I change levels?',
      a: 'Anytime. Manage your membership at vitalityproject.global and the Clubhouse updates with it — new courses and sessions open right away.',
    },
    {
      q: 'Who sees what I post?',
      a: 'Signed-in members and the Vitality team. The Clubhouse is private, search engines are told to stay out, and photos are stripped of location data on upload.',
    },
  ]
}

export function tierName(tier: MembershipTier): string {
  return tier === 'NONE' ? 'Guest' : VIP_COPY.tiers[tier].name
}
