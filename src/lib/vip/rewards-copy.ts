/**
 * Clubhouse copy for the points economy (rewards hub, catalog, partners,
 * leaderboard, partner portal). Numbers are never written here — they come
 * from the live settings (lib/vip/earning.ts) and the partner records.
 */
export const REWARDS_COPY = {
  title: 'Rewards',
  intro:
    'Every purchase, lesson, event and partner visit earns points. 100 points are worth $1 — spend them on store credit, gear, trainings and sessions, or at partner businesses.',
  pointsLabel: 'Your points',
  creditTitle: 'Monthly store credit',
  earnTitle: 'Ways to earn',
  referTitle: 'Invite a friend',
  referBody: (pts: string) =>
    `Share your link. When someone joins with it and their first month is paid, ${pts} points land in your account.`,
  badgesTitle: 'Badges',
  historyTitle: 'Points history',
  creditHistoryTitle: 'Store credit history',
  emptyHistory: { title: 'No points yet.', body: 'Complete a lesson, join a live event or shop at vitalityproject.global to start earning.' },
  expiry: (date: string) => `Points stay active while you use them. With no activity, your balance would expire on ${date} — earning or spending any points resets the clock.`,
  expirySoon: (date: string) => `Heads up: your points expire on ${date} unless you earn or spend some before then.`,

  catalogTitle: 'Redeem your points',
  catalogIntro: 'Store credit lands right away and trainings unlock instantly. Gear and sessions go to the team, who confirm and ship or schedule them.',
  catalogEmpty: { title: 'New rewards are on the way.', body: 'The team is stocking the catalog. Keep earning — your points keep their value.' },

  redemptionsTitle: 'My redemptions',
  redemptionsEmpty: { title: 'Nothing redeemed yet.', body: 'Rewards you redeem show up here with their status.' },

  partnersTitle: 'Partner businesses',
  partnersIntro:
    'Businesses in the Vitality network. Show your member card when you pay to earn points, and spend points at partners that accept them — you approve every spend with a one-time code from this page.',
  partnersEmpty: { title: 'Partners are joining soon.', body: 'When the first partner business joins the network it will appear here.' },

  leaderboardTitle: 'This month’s leaderboard',
  leaderboardIntro: 'Points earned this month across the clubhouse, the store and partner businesses. Spending never lowers your score.',
  leaderboardEmpty: { title: 'The board resets on the 1st.', body: 'Earn points this month to take the first spot.' },
  hideLabel: 'Hide me from leaderboards',
  hideHelp: 'You still earn points and see your own score.',

  portalTitle: 'Partner portal',
  portalIntro: 'Record member purchases, take points as payment, and void mistakes within 24 hours.',
  portalSignin: 'Sign in with the account the Vitality team linked to your business.',
  portalNoAccess: 'This account is not linked to a partner business. Ask the Vitality team to add you as staff.',
} as const
