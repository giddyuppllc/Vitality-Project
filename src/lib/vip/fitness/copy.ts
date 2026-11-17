/**
 * Member-facing copy for Fitness, Health & Lifestyle. General wellness only:
 * training, food, sleep, recovery, habits. No compound, supplement or
 * medical content, and no claims.
 */
export const FIT_COPY = {
  hub: {
    title: 'Fitness',
    intro: 'Your training, habits and progress in one place. Everything you log here is private to you.',
  },
  programs: {
    title: 'Programs',
    intro: 'Multi-week training plans from the coaching team. Start one and the next session is always waiting on your Today page.',
    empty: { title: 'No programs published yet.', body: 'The coaching team is building them. Until then, start a freestyle workout from Today and log what you do.' },
  },
  exercises: {
    title: 'Exercise library',
    intro: 'How to perform each movement, what it works and what you need for it.',
    empty: { title: 'No exercises match.', body: 'Try a different word or clear the filters.' },
    emptyLibrary: { title: 'The library is being stocked.', body: 'Exercises appear here as the coaching team adds them.' },
  },
  history: {
    title: 'History',
    intro: 'Every finished workout, your weekly totals and your personal records.',
    empty: { title: 'No finished workouts yet.', body: 'Finish your first workout and it shows up here with its totals and any records you set.' },
  },
  health: {
    title: 'Health',
    intro: 'A daily check-in, your body measurements and progress photos. Only you can see this page.',
    privacy: 'Private to you. Coaches and other members never see your check-ins, measurements or photos.',
  },
  challenges: {
    title: 'Challenges',
    intro: 'Time-boxed goals with the rest of the clubhouse. Hit the target to earn the badge and the points.',
    empty: { title: 'No challenges right now.', body: 'New challenges are announced in the community. Check back soon.' },
  },
  lifestyle: {
    title: 'Lifestyle',
    intro: 'Guides on nutrition, recovery, sleep and mindset, plus recipes from the coaching team.',
    empty: { title: 'Nothing published here yet.', body: 'Guides and recipes appear here as the coaching team publishes them.' },
  },
  wellnessNote:
    'General fitness and wellness information, not medical advice. Check in with your healthcare provider before starting a new training plan or making big changes to your routine.',
} as const
