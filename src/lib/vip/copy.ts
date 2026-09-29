/**
 * Clubhouse copy slots.
 *
 * Marketing / descriptive copy is Kevin's (and Edward's) to write — none is
 * invented here. Every slot below is `null` until they supply it; while null,
 * the page renders a clearly marked "copy needed" placeholder box instead of
 * made-up text, so an unfinished page can never ship looking finished.
 *
 * Neutral UI labels (Sign in, Feed, Classroom, …) live in the components.
 */
export const VIP_COPY: Record<
  'landingHeadline' | 'landingIntro' | 'landingCommunity' | 'landingClassroom' | 'landingEvents' | 'landingRewards' | 'communityGuidelines',
  string | null
> = {
  landingHeadline: null,
  landingIntro: null,
  landingCommunity: null,
  landingClassroom: null,
  landingEvents: null,
  landingRewards: null,
  communityGuidelines: null,
}
