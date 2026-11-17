/**
 * Options in the first-run flow (/welcome). Stored by key on VipOnboarding.
 * Pure data — safe for client components.
 */

export const ONBOARDING_INTERESTS = [
  { key: 'training', label: 'Strength & training' },
  { key: 'conditioning', label: 'Conditioning & cardio' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'sleep', label: 'Sleep & recovery' },
  { key: 'longevity', label: 'Longevity' },
  { key: 'research', label: 'Reading the research' },
  { key: 'mindset', label: 'Mindset & focus' },
  { key: 'community', label: 'Meeting other members' },
] as const

export const ONBOARDING_GOALS = [
  { key: 'strength', label: 'Get stronger' },
  { key: 'body-composition', label: 'Change my body composition' },
  { key: 'energy', label: 'Have more energy' },
  { key: 'sleep', label: 'Sleep better' },
  { key: 'recovery', label: 'Recover faster' },
  { key: 'habits', label: 'Build habits that stick' },
  { key: 'learn', label: 'Understand the science' },
  { key: 'consistency', label: 'Stay consistent' },
] as const

export const MAX_GOALS = 3
export const INTEREST_KEYS = ONBOARDING_INTERESTS.map((i) => i.key) as unknown as readonly [string, ...string[]]
export const GOAL_KEYS = ONBOARDING_GOALS.map((g) => g.key) as unknown as readonly [string, ...string[]]
