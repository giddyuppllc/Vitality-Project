/**
 * Copy for the clubhouse social network (follows, profiles, messages,
 * discovery). Same voice as lib/vip/copy.ts: short, warm, positive.
 */
export const SOCIAL_COPY = {
  following: {
    emptyTitle: 'Your Following feed starts with one follow.',
    emptyBody: 'Follow members whose training, meals and wins you want to keep up with — their posts land here.',
  },
  saved: {
    title: 'Saved posts',
    intro: 'Posts you saved to come back to. Only you can see this list.',
    emptyTitle: 'Nothing saved yet.',
    emptyBody: 'Tap Save on any post to keep it here — a plan to try, a recipe, a thread worth rereading.',
  },
  discover: {
    title: 'Discover',
    intro: 'Find members by name, username or interest, and see what the community is talking about.',
    searchLabel: 'Search members and hashtags',
    searchPlaceholder: 'Name, @username, interest or #hashtag',
    trendingTitle: 'Trending this week',
    trendingEmpty: 'No hashtags this week yet. Add one to your next post — #sleep, #mobility, #mealprep.',
    noMembers: 'No members match that search.',
    noTags: 'No hashtags match that search.',
    membersTitle: 'Members',
    tagsTitle: 'Hashtags',
    allFollowedTitle: 'You’re following everyone here.',
    allFollowedBody: 'New members show up here as they join.',
  },
  tag: {
    empty: 'No posts carry this hashtag yet. Be the first to use it.',
  },
  profile: {
    followersOnlyTitle: 'This profile is for followers.',
    followersOnlyBody: 'Follow to see their posts, activity and who they follow.',
    blockedTitle: 'You blocked this member.',
    blockedBody: 'You won’t see each other’s posts, profile or messages. Unblock to undo it.',
    noPosts: 'No posts yet.',
    noActivity: 'No activity yet.',
    noFollowers: 'No followers yet.',
    noFollowing: 'Not following anyone yet.',
    noBadgesSelf: 'Badges you earn in the clubhouse show here.',
    noBadges: 'No badges yet.',
  },
  messages: {
    title: 'Messages',
    intro: 'Private conversations with members and small groups.',
    emptyTitle: 'No conversations yet.',
    emptyBody: 'Start one from a member’s profile, or tap New message.',
    threadEmpty: 'Say hello — this is the start of your conversation.',
    newTitle: 'New message',
    newIntro: 'Pick one member for a private conversation, or up to 19 for a group.',
  },
} as const
