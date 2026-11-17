import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { makeUser, params, req, setSession } from '../helpers'
import { requireVipPage } from '@/lib/vip/page-gate'

import * as posts from '@/app/api/vip/posts/route'
import * as post from '@/app/api/vip/posts/[id]/route'
import * as comments from '@/app/api/vip/posts/[id]/comments/route'
import * as comment from '@/app/api/vip/comments/[id]/route'
import * as reactions from '@/app/api/vip/reactions/route'
import * as reports from '@/app/api/vip/reports/route'
import * as notifications from '@/app/api/vip/notifications/route'
import * as profile from '@/app/api/vip/profile/route'
import * as members from '@/app/api/vip/members/route'
import * as uploads from '@/app/api/vip/uploads/route'
import * as media from '@/app/api/vip/media/[...path]/route'
import * as progress from '@/app/api/vip/lessons/[id]/progress/route'
import * as rsvp from '@/app/api/vip/events/[id]/rsvp/route'
import * as rewards from '@/app/api/vip/rewards/route'
import * as emailPrefs from '@/app/api/vip/email-prefs/route'
import * as onboarding from '@/app/api/vip/onboarding/route'
import * as rewardsRedeem from '@/app/api/vip/rewards/redeem/route'
import * as rewardsRedemption from '@/app/api/vip/rewards/redemptions/[id]/route'
import * as rewardsPartnerCode from '@/app/api/vip/rewards/partner-code/route'
import * as rewardsPrefs from '@/app/api/vip/rewards/prefs/route'
import * as bookmarks from '@/app/api/vip/bookmarks/route'
import * as discover from '@/app/api/vip/discover/route'
import * as follow from '@/app/api/vip/members/[id]/follow/route'
import * as block from '@/app/api/vip/members/[id]/block/route'
import * as follows from '@/app/api/vip/members/[id]/follows/route'
import * as suggest from '@/app/api/vip/members/suggest/route'
import * as messages from '@/app/api/vip/messages/route'
import * as messagesUnread from '@/app/api/vip/messages/unread/route'
import * as conversation from '@/app/api/vip/messages/[id]/route'
import * as adminMedia from '@/app/api/admin/vip/media/[...path]/route'
import * as adminSettings from '@/app/api/admin/vip/settings/route'
import * as adminSpaces from '@/app/api/admin/vip/spaces/route'
import * as adminSpace from '@/app/api/admin/vip/spaces/[id]/route'
import * as adminModeration from '@/app/api/admin/vip/moderation/route'
import * as adminClassroom from '@/app/api/admin/vip/classroom/route'
import * as adminEvents from '@/app/api/admin/vip/events/route'
import * as adminRewards from '@/app/api/admin/vip/rewards/route'
import * as adminCatalog from '@/app/api/admin/vip/rewards/catalog/route'
import * as adminRedemptions from '@/app/api/admin/vip/rewards/redemptions/route'
import * as adminEarning from '@/app/api/admin/vip/rewards/earning/route'
import * as adminPoints from '@/app/api/admin/vip/rewards/points/route'
import * as adminUpload from '@/app/api/admin/vip/rewards/upload/route'
import * as adminPartners from '@/app/api/admin/vip/partners/route'
import * as adminStatements from '@/app/api/admin/vip/partners/statements/route'
// Academy / Library / Events upgrade (vip/academy)
import * as lessonNote from '@/app/api/vip/lessons/[id]/note/route'
import * as quizAttempts from '@/app/api/vip/quizzes/[id]/attempts/route'
import * as trainingRedeem from '@/app/api/vip/trainings/[id]/redeem/route'
import * as trainingInvoice from '@/app/api/vip/trainings/[id]/invoice/route'
import * as vipFiles from '@/app/api/vip/files/[id]/route'
import * as eventIcs from '@/app/api/vip/events/[id]/ics/route'
import * as eventJoin from '@/app/api/vip/events/[id]/join/route'
import * as adminFiles from '@/app/api/admin/vip/files/route'
import * as adminLibrary from '@/app/api/admin/vip/library/route'
import * as fitPrefs from '@/app/api/vip/fitness/prefs/route'
import * as fitProgram from '@/app/api/vip/fitness/programs/[id]/route'
import * as fitWorkouts from '@/app/api/vip/fitness/workouts/route'
import * as fitWorkout from '@/app/api/vip/fitness/workouts/[id]/route'
import * as fitWorkoutExercises from '@/app/api/vip/fitness/workouts/[id]/exercises/route'
import * as fitSets from '@/app/api/vip/fitness/workouts/[id]/sets/route'
import * as fitSet from '@/app/api/vip/fitness/workouts/[id]/sets/[setId]/route'
import * as fitFinish from '@/app/api/vip/fitness/workouts/[id]/finish/route'
import * as fitCheckins from '@/app/api/vip/fitness/checkins/route'
import * as fitMetrics from '@/app/api/vip/fitness/metrics/route'
import * as fitMetric from '@/app/api/vip/fitness/metrics/[id]/route'
import * as fitPhotos from '@/app/api/vip/fitness/photos/route'
import * as fitPhoto from '@/app/api/vip/fitness/photos/[id]/route'
import * as fitChallenge from '@/app/api/vip/fitness/challenges/[id]/route'
import * as fitExercises from '@/app/api/vip/fitness/exercises/route'
import * as adminFitExercises from '@/app/api/admin/vip/fitness/exercises/route'
import * as adminFitPrograms from '@/app/api/admin/vip/fitness/programs/route'
import * as adminFitChallenges from '@/app/api/admin/vip/fitness/challenges/route'
import * as adminFitArticles from '@/app/api/admin/vip/fitness/articles/route'
import * as adminFitSettings from '@/app/api/admin/vip/fitness/settings/route'

type Handler = (r: NextRequest, ctx: { params: Promise<Record<string, unknown>> }) => Promise<Response>
/** `passed`: statuses that mean the gate let the request through (default 200/201/404). */
type Case = { name: string; gate: 'community' | 'member'; run: () => Promise<Response>; passed?: number[] }

let postId = 'missing'
const ctx = (p: Record<string, unknown>) => params(p)
const h = (fn: unknown) => fn as Handler

// Every member-facing clubhouse API handler, with its gate level.
const CASES: Case[] = [
  { name: 'GET /posts', gate: 'community', run: () => h(posts.GET)(req('/api/vip/posts'), ctx({})) },
  { name: 'POST /posts', gate: 'community', run: () => h(posts.POST)(req('/api/vip/posts', { body: { body: `gate ${Math.random()}` } }), ctx({})) },
  { name: 'GET /posts/:id', gate: 'community', run: () => h(post.GET)(req(`/api/vip/posts/${postId}`), ctx({ id: postId })) },
  { name: 'PATCH /posts/:id', gate: 'community', run: () => h(post.PATCH)(req(`/api/vip/posts/${postId}`, { method: 'PATCH', body: { body: 'x' } }), ctx({ id: postId })) },
  { name: 'DELETE /posts/:id', gate: 'community', run: () => h(post.DELETE)(req(`/api/vip/posts/${postId}`, { method: 'DELETE' }), ctx({ id: postId })) },
  { name: 'POST /posts/:id/comments', gate: 'community', run: () => h(comments.POST)(req(`/api/vip/posts/${postId}/comments`, { body: { body: `c ${Math.random()}` } }), ctx({ id: postId })) },
  { name: 'DELETE /comments/:id', gate: 'community', run: () => h(comment.DELETE)(req('/api/vip/comments/missing', { method: 'DELETE' }), ctx({ id: 'missing' })) },
  { name: 'POST /reactions', gate: 'community', run: () => h(reactions.POST)(req('/api/vip/reactions', { body: { postId } }), ctx({})) },
  { name: 'POST /reports', gate: 'community', run: () => h(reports.POST)(req('/api/vip/reports', { body: { postId, reason: 'gate test' } }), ctx({})) },
  { name: 'GET /notifications', gate: 'community', run: () => h(notifications.GET)(req('/api/vip/notifications'), ctx({})) },
  { name: 'POST /notifications', gate: 'community', run: () => h(notifications.POST)(req('/api/vip/notifications', { body: { all: true } }), ctx({})) },
  { name: 'PATCH /profile', gate: 'community', run: () => h(profile.PATCH)(req('/api/vip/profile', { method: 'PATCH', body: { bio: 'x' } }), ctx({})) },
  { name: 'GET /members', gate: 'community', run: () => h(members.GET)(req('/api/vip/members'), ctx({})) },
  { name: 'POST /uploads', gate: 'community', run: () => h(uploads.POST)(req('/api/vip/uploads', { body: {} }), ctx({})) },
  { name: 'GET /bookmarks', gate: 'community', run: () => h(bookmarks.GET)(req('/api/vip/bookmarks'), ctx({})) },
  { name: 'POST /bookmarks', gate: 'community', run: () => h(bookmarks.POST)(req('/api/vip/bookmarks', { body: { postId } }), ctx({})) },
  { name: 'GET /discover', gate: 'community', run: () => h(discover.GET)(req('/api/vip/discover?q=zz'), ctx({})) },
  { name: 'POST /members/:id/follow', gate: 'community', run: () => h(follow.POST)(req('/api/vip/members/missing/follow', { method: 'POST' }), ctx({ id: 'missing' })) },
  { name: 'DELETE /members/:id/follow', gate: 'community', run: () => h(follow.DELETE)(req('/api/vip/members/missing/follow', { method: 'DELETE' }), ctx({ id: 'missing' })) },
  { name: 'POST /members/:id/block', gate: 'community', run: () => h(block.POST)(req('/api/vip/members/missing/block', { method: 'POST' }), ctx({ id: 'missing' })) },
  { name: 'DELETE /members/:id/block', gate: 'community', run: () => h(block.DELETE)(req('/api/vip/members/missing/block', { method: 'DELETE' }), ctx({ id: 'missing' })) },
  { name: 'GET /members/:id/follows', gate: 'community', run: () => h(follows.GET)(req('/api/vip/members/missing/follows'), ctx({ id: 'missing' })) },
  { name: 'GET /members/suggest', gate: 'community', run: () => h(suggest.GET)(req('/api/vip/members/suggest?q=zz'), ctx({})) },
  { name: 'GET /messages', gate: 'community', run: () => h(messages.GET)(req('/api/vip/messages'), ctx({})) },
  { name: 'POST /messages', gate: 'community', run: () => h(messages.POST)(req('/api/vip/messages', { body: { recipientId: 'missing' } }), ctx({})) },
  { name: 'GET /messages/unread', gate: 'community', run: () => h(messagesUnread.GET)(req('/api/vip/messages/unread'), ctx({})) },
  { name: 'GET /messages/:id', gate: 'community', run: () => h(conversation.GET)(req('/api/vip/messages/missing'), ctx({ id: 'missing' })) },
  { name: 'POST /messages/:id', gate: 'community', run: () => h(conversation.POST)(req('/api/vip/messages/missing', { body: { body: 'hi' } }), ctx({ id: 'missing' })) },
  { name: 'PATCH /messages/:id', gate: 'community', run: () => h(conversation.PATCH)(req('/api/vip/messages/missing', { method: 'PATCH', body: { read: true } }), ctx({ id: 'missing' })) },
  { name: 'DELETE /messages/:id', gate: 'community', run: () => h(conversation.DELETE)(req('/api/vip/messages/missing', { method: 'DELETE' }), ctx({ id: 'missing' })) },
  { name: 'GET /profile', gate: 'member', run: () => h(profile.GET)(req('/api/vip/profile'), ctx({})) },
  { name: 'GET /media/*', gate: 'member', run: () => h(media.GET)(req('/api/vip/media/2026-01/x.jpg'), ctx({ path: ['2026-01', 'x.jpg'] })) },
  { name: 'POST /lessons/:id/progress', gate: 'member', run: () => h(progress.POST)(req('/api/vip/lessons/missing/progress', { method: 'POST' }), ctx({ id: 'missing' })) },
  { name: 'DELETE /lessons/:id/progress', gate: 'member', run: () => h(progress.DELETE)(req('/api/vip/lessons/missing/progress', { method: 'DELETE' }), ctx({ id: 'missing' })) },
  { name: 'POST /events/:id/rsvp', gate: 'member', run: () => h(rsvp.POST)(req('/api/vip/events/missing/rsvp', { method: 'POST' }), ctx({ id: 'missing' })) },
  { name: 'DELETE /events/:id/rsvp', gate: 'member', run: () => h(rsvp.DELETE)(req('/api/vip/events/missing/rsvp', { method: 'DELETE' }), ctx({ id: 'missing' })) },
  { name: 'GET /rewards', gate: 'member', run: () => h(rewards.GET)(req('/api/vip/rewards'), ctx({})) },
  { name: 'GET /email-prefs', gate: 'member', run: () => h(emailPrefs.GET)(req('/api/vip/email-prefs'), ctx({})) },
  { name: 'PATCH /email-prefs', gate: 'member', run: () => h(emailPrefs.PATCH)(req('/api/vip/email-prefs', { method: 'PATCH', body: { emailDigest: true } }), ctx({})) },
  { name: 'POST /onboarding', gate: 'member', run: () => h(onboarding.POST)(req('/api/vip/onboarding', { method: 'POST' }), ctx({})) },
  { name: 'POST /rewards/redeem', gate: 'member', run: () => h(rewardsRedeem.POST)(req('/api/vip/rewards/redeem', { body: { itemId: 'missing', clickKey: 'gate-test-key' } }), ctx({})) },
  { name: 'DELETE /rewards/redemptions/:id', gate: 'member', run: () => h(rewardsRedemption.DELETE)(req('/api/vip/rewards/redemptions/missing', { method: 'DELETE' }), ctx({ id: 'missing' })) },
  { name: 'POST /rewards/partner-code', gate: 'member', run: () => h(rewardsPartnerCode.POST)(req('/api/vip/rewards/partner-code', { body: { partnerId: 'missing', points: 100 } }), ctx({})) },
  { name: 'GET /rewards/prefs', gate: 'member', run: () => h(rewardsPrefs.GET)(req('/api/vip/rewards/prefs'), ctx({})) },
  { name: 'PATCH /rewards/prefs', gate: 'member', run: () => h(rewardsPrefs.PATCH)(req('/api/vip/rewards/prefs', { method: 'PATCH', body: { hideFromLeaderboards: false } }), ctx({})) },
  { name: 'PUT /onboarding', gate: 'member', run: () => h(onboarding.PUT)(req('/api/vip/onboarding', { method: 'PUT', body: { skip: true } }), ctx({})) },
  { name: 'PUT /lessons/:id/note', gate: 'member', run: () => h(lessonNote.PUT)(req('/api/vip/lessons/missing/note', { method: 'PUT', body: { body: 'x' } }), ctx({ id: 'missing' })) },
  { name: 'POST /quizzes/:id/attempts', gate: 'member', run: () => h(quizAttempts.POST)(req('/api/vip/quizzes/missing/attempts', { body: { answers: {} } }), ctx({ id: 'missing' })) },
  { name: 'POST /trainings/:id/redeem', gate: 'member', run: () => h(trainingRedeem.POST)(req('/api/vip/trainings/missing/redeem', { method: 'POST' }), ctx({ id: 'missing' })) },
  { name: 'POST /trainings/:id/invoice', gate: 'member', run: () => h(trainingInvoice.POST)(req('/api/vip/trainings/missing/invoice', { method: 'POST' }), ctx({ id: 'missing' })) },
  { name: 'GET /files/:id', gate: 'member', run: () => h(vipFiles.GET)(req('/api/vip/files/missingfile00'), ctx({ id: 'missingfile00' })) },
  { name: 'GET /events/:id/ics', gate: 'member', run: () => h(eventIcs.GET)(req('/api/vip/events/missing/ics'), ctx({ id: 'missing' })) },
  { name: 'GET /events/:id/join', gate: 'member', run: () => h(eventJoin.GET)(req('/api/vip/events/missing/join'), ctx({ id: 'missing' })) },
  // Fitness, health & lifestyle (member gate: suspension from the community keeps them).
  { name: 'GET /fitness/prefs', gate: 'member', run: () => h(fitPrefs.GET)(req('/api/vip/fitness/prefs'), ctx({})) },
  { name: 'PATCH /fitness/prefs', gate: 'member', run: () => h(fitPrefs.PATCH)(req('/api/vip/fitness/prefs', { method: 'PATCH', body: { units: 'IMPERIAL' } }), ctx({})) },
  { name: 'POST /fitness/programs/:id', gate: 'member', run: () => h(fitProgram.POST)(req('/api/vip/fitness/programs/missing', { body: { action: 'enroll' } }), ctx({ id: 'missing' })) },
  { name: 'GET /fitness/workouts', gate: 'member', run: () => h(fitWorkouts.GET)(req('/api/vip/fitness/workouts'), ctx({})) },
  { name: 'POST /fitness/workouts', gate: 'member', run: () => h(fitWorkouts.POST)(req('/api/vip/fitness/workouts', { body: { programDayId: 'missing' } }), ctx({})) },
  { name: 'GET /fitness/workouts/:id', gate: 'member', run: () => h(fitWorkout.GET)(req('/api/vip/fitness/workouts/missing'), ctx({ id: 'missing' })) },
  { name: 'PATCH /fitness/workouts/:id', gate: 'member', run: () => h(fitWorkout.PATCH)(req('/api/vip/fitness/workouts/missing', { method: 'PATCH', body: { title: 'x' } }), ctx({ id: 'missing' })) },
  { name: 'DELETE /fitness/workouts/:id', gate: 'member', run: () => h(fitWorkout.DELETE)(req('/api/vip/fitness/workouts/missing', { method: 'DELETE' }), ctx({ id: 'missing' })) },
  { name: 'POST /fitness/workouts/:id/exercises', gate: 'member', run: () => h(fitWorkoutExercises.POST)(req('/api/vip/fitness/workouts/missing/exercises', { body: { exerciseId: 'x' } }), ctx({ id: 'missing' })) },
  { name: 'DELETE /fitness/workouts/:id/exercises', gate: 'member', run: () => h(fitWorkoutExercises.DELETE)(req('/api/vip/fitness/workouts/missing/exercises', { method: 'DELETE', body: { exerciseId: 'x' } }), ctx({ id: 'missing' })) },
  { name: 'POST /fitness/workouts/:id/sets', gate: 'member', run: () => h(fitSets.POST)(req('/api/vip/fitness/workouts/missing/sets', { body: { exerciseId: 'x', reps: 5 } }), ctx({ id: 'missing' })) },
  { name: 'PATCH /fitness/workouts/:id/sets/:setId', gate: 'member', run: () => h(fitSet.PATCH)(req('/api/vip/fitness/workouts/missing/sets/x', { method: 'PATCH', body: { reps: 5 } }), ctx({ id: 'missing', setId: 'x' })) },
  { name: 'DELETE /fitness/workouts/:id/sets/:setId', gate: 'member', run: () => h(fitSet.DELETE)(req('/api/vip/fitness/workouts/missing/sets/x', { method: 'DELETE' }), ctx({ id: 'missing', setId: 'x' })) },
  { name: 'POST /fitness/workouts/:id/finish', gate: 'member', run: () => h(fitFinish.POST)(req('/api/vip/fitness/workouts/missing/finish', { body: {} }), ctx({ id: 'missing' })) },
  { name: 'GET /fitness/checkins', gate: 'member', run: () => h(fitCheckins.GET)(req('/api/vip/fitness/checkins'), ctx({})) },
  { name: 'PUT /fitness/checkins', gate: 'member', run: () => h(fitCheckins.PUT)(req('/api/vip/fitness/checkins', { method: 'PUT', body: { mood: 3 } }), ctx({})) },
  { name: 'GET /fitness/metrics', gate: 'member', run: () => h(fitMetrics.GET)(req('/api/vip/fitness/metrics'), ctx({})) },
  { name: 'PUT /fitness/metrics', gate: 'member', run: () => h(fitMetrics.PUT)(req('/api/vip/fitness/metrics', { method: 'PUT', body: { date: new Date(Date.now() - 3 * 86400e3).toISOString().slice(0, 10), weight: 150 } }), ctx({})) },
  { name: 'DELETE /fitness/metrics/:id', gate: 'member', run: () => h(fitMetric.DELETE)(req('/api/vip/fitness/metrics/missing', { method: 'DELETE' }), ctx({ id: 'missing' })) },
  { name: 'GET /fitness/photos', gate: 'member', run: () => h(fitPhotos.GET)(req('/api/vip/fitness/photos'), ctx({})) },
  // No file: past the gate it is a 400 (bad upload), never a 401/403.
  { name: 'POST /fitness/photos', gate: 'member', passed: [400], run: () => h(fitPhotos.POST)(req('/api/vip/fitness/photos', { body: {} }), ctx({})) },
  { name: 'GET /fitness/photos/:id', gate: 'member', run: () => h(fitPhoto.GET)(req('/api/vip/fitness/photos/missing'), ctx({ id: 'missing' })) },
  { name: 'DELETE /fitness/photos/:id', gate: 'member', run: () => h(fitPhoto.DELETE)(req('/api/vip/fitness/photos/missing', { method: 'DELETE' }), ctx({ id: 'missing' })) },
  { name: 'GET /fitness/challenges/:id', gate: 'member', run: () => h(fitChallenge.GET)(req('/api/vip/fitness/challenges/missing'), ctx({ id: 'missing' })) },
  { name: 'POST /fitness/challenges/:id', gate: 'member', run: () => h(fitChallenge.POST)(req('/api/vip/fitness/challenges/missing', { body: { action: 'join' } }), ctx({ id: 'missing' })) },
  { name: 'GET /fitness/exercises', gate: 'member', run: () => h(fitExercises.GET)(req('/api/vip/fitness/exercises'), ctx({})) },
]

const ADMIN_CASES: { name: string; run: () => Promise<Response> }[] = [
  { name: 'GET spaces', run: () => h(adminSpaces.GET)(req('/api/admin/vip/spaces'), ctx({})) },
  { name: 'POST spaces', run: () => h(adminSpaces.POST)(req('/api/admin/vip/spaces', { body: { name: 'x' } }), ctx({})) },
  { name: 'PATCH space', run: () => h(adminSpace.PATCH)(req('/api/admin/vip/spaces/x', { method: 'PATCH', body: {} }), ctx({ id: 'x' })) },
  { name: 'POST moderation', run: () => h(adminModeration.POST)(req('/api/admin/vip/moderation', { body: { action: 'hide_post', postId } }), ctx({})) },
  { name: 'POST classroom', run: () => h(adminClassroom.POST)(req('/api/admin/vip/classroom', { body: { op: 'course.delete', id: 'x' } }), ctx({})) },
  { name: 'POST events', run: () => h(adminEvents.POST)(req('/api/admin/vip/events', { body: { op: 'delete', id: 'x' } }), ctx({})) },
  { name: 'GET rewards', run: () => h(adminRewards.GET)(req('/api/admin/vip/rewards'), ctx({})) },
  { name: 'PUT rewards', run: () => h(adminRewards.PUT)(req('/api/admin/vip/rewards', { method: 'PUT', body: { CLUB: 1, PLUS: 1, PREMIUM: 1 } }), ctx({})) },
  { name: 'GET settings', run: () => h(adminSettings.GET)(req('/api/admin/vip/settings'), ctx({})) },
  { name: 'PUT settings', run: () => h(adminSettings.PUT)(req('/api/admin/vip/settings', { method: 'PUT', body: { 'vip.digestHourUtc': 13 } }), ctx({})) },
  { name: 'GET catalog', run: () => h(adminCatalog.GET)(req('/api/admin/vip/rewards/catalog'), ctx({})) },
  { name: 'POST catalog', run: () => h(adminCatalog.POST)(req('/api/admin/vip/rewards/catalog', { body: { op: 'delete', id: 'x' } }), ctx({})) },
  { name: 'GET redemptions', run: () => h(adminRedemptions.GET)(req('/api/admin/vip/rewards/redemptions'), ctx({})) },
  { name: 'POST redemptions', run: () => h(adminRedemptions.POST)(req('/api/admin/vip/rewards/redemptions', { body: { op: 'cancel', id: 'x' } }), ctx({})) },
  { name: 'GET earning', run: () => h(adminEarning.GET)(req('/api/admin/vip/rewards/earning'), ctx({})) },
  { name: 'PUT earning', run: () => h(adminEarning.PUT)(req('/api/admin/vip/rewards/earning', { method: 'PUT', body: {} }), ctx({})) },
  { name: 'GET points', run: () => h(adminPoints.GET)(req('/api/admin/vip/rewards/points?q=x'), ctx({})) },
  { name: 'POST points', run: () => h(adminPoints.POST)(req('/api/admin/vip/rewards/points', { body: { member: 'x@example.invalid', points: 5, reason: 'gate', clickKey: 'gate-test-key' } }), ctx({})) },
  { name: 'POST upload', run: () => h(adminUpload.POST)(req('/api/admin/vip/rewards/upload', { body: {} }), ctx({})) },
  { name: 'GET partners', run: () => h(adminPartners.GET)(req('/api/admin/vip/partners'), ctx({})) },
  { name: 'POST partners', run: () => h(adminPartners.POST)(req('/api/admin/vip/partners', { body: { op: 'staff.remove', id: 'x' } }), ctx({})) },
  { name: 'GET statements', run: () => h(adminStatements.GET)(req('/api/admin/vip/partners/statements'), ctx({})) },
  { name: 'POST statements', run: () => h(adminStatements.POST)(req('/api/admin/vip/partners/statements', { body: { op: 'issue', id: 'x' } }), ctx({})) },
  { name: 'POST files', run: () => h(adminFiles.POST)(req('/api/admin/vip/files', { body: {} }), ctx({})) },
  { name: 'POST library', run: () => h(adminLibrary.POST)(req('/api/admin/vip/library', { body: { op: 'delete', id: 'x' } }), ctx({})) },
  { name: 'GET media (reported DM photo)', run: () => h(adminMedia.GET)(req('/api/admin/vip/media/2026-01/x.jpg?c=x'), ctx({ path: ['2026-01', 'x.jpg'] })) },
  { name: 'POST fitness exercises', run: () => h(adminFitExercises.POST)(req('/api/admin/vip/fitness/exercises', { body: { op: 'exercise.delete', id: 'x' } }), ctx({})) },
  { name: 'POST fitness programs', run: () => h(adminFitPrograms.POST)(req('/api/admin/vip/fitness/programs', { body: { op: 'program.delete', id: 'x' } }), ctx({})) },
  { name: 'POST fitness challenges', run: () => h(adminFitChallenges.POST)(req('/api/admin/vip/fitness/challenges', { body: { op: 'challenge.delete', id: 'x' } }), ctx({})) },
  { name: 'POST fitness articles', run: () => h(adminFitArticles.POST)(req('/api/admin/vip/fitness/articles', { body: { op: 'article.delete', id: 'x' } }), ctx({})) },
  { name: 'GET fitness settings', run: () => h(adminFitSettings.GET)(req('/api/admin/vip/fitness/settings'), ctx({})) },
  { name: 'PUT fitness settings', run: () => h(adminFitSettings.PUT)(req('/api/admin/vip/fitness/settings', { method: 'PUT', body: {} }), ctx({})) },
]

let users: Record<string, { id: string; email: string; role: string }>

beforeAll(async () => {
  const author = await makeUser({ tag: 'gate-author', tier: 'PREMIUM' })
  postId = (await prisma.vipPost.create({ data: { authorId: author.id, body: 'gate fixture post' } })).id
  users = {
    none: await makeUser({ tag: 'gate-none' }),
    pending: await makeUser({ tag: 'gate-pending', tier: 'PLUS', status: 'PENDING_PAYMENT' }),
    pastDue: await makeUser({ tag: 'gate-pastdue', tier: 'PREMIUM', status: 'PAST_DUE' }),
    cancelled: await makeUser({ tag: 'gate-cancelled', tier: 'CLUB', status: 'CANCELLED' }),
    suspended: await makeUser({ tag: 'gate-suspended', tier: 'PLUS', suspended: true }),
    member: await makeUser({ tag: 'gate-member', tier: 'CLUB' }),
  }
})

describe('members-only gating — every clubhouse API', () => {
  it('covers every route file under src/app/api/vip (a new route must be added here)', () => {
    const root = path.resolve(__dirname, '../../src/app/api/vip')
    const files: string[] = []
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = path.join(d, f)
        if (statSync(p).isDirectory()) walk(p)
        else if (f === 'route.ts') files.push(path.relative(root, p).replace(/\\/g, '/'))
      }
    }
    walk(root)
    // auth/login + auth/logout are intentionally public (they create/clear the session).
    // email-prefs POST is the signed one-click opt-out (token-gated, tested in emails.test.ts);
    // its GET/PATCH are member-gated and listed in CASES.
    // partner-portal is for partner-business STAFF, not members (gated by VipPartnerStaff,
    // tested in partners.test.ts).
    const gated = files.filter((f) => !f.startsWith('auth/') && !f.startsWith('partner-portal/'))
    expect(gated.sort()).toEqual(
      [
        'comments/[id]/route.ts', 'events/[id]/rsvp/route.ts', 'lessons/[id]/progress/route.ts', 'media/[...path]/route.ts',
        'members/route.ts', 'notifications/route.ts', 'posts/[id]/comments/route.ts', 'posts/[id]/route.ts', 'posts/route.ts',
        'profile/route.ts', 'reactions/route.ts', 'reports/route.ts', 'rewards/route.ts', 'uploads/route.ts',
        'email-prefs/route.ts', 'onboarding/route.ts',
        'rewards/redeem/route.ts', 'rewards/redemptions/[id]/route.ts', 'rewards/partner-code/route.ts', 'rewards/prefs/route.ts',
        'lessons/[id]/note/route.ts', 'quizzes/[id]/attempts/route.ts', 'trainings/[id]/redeem/route.ts',
        'trainings/[id]/invoice/route.ts', 'files/[id]/route.ts', 'events/[id]/ics/route.ts', 'events/[id]/join/route.ts',
        'bookmarks/route.ts', 'discover/route.ts', 'members/[id]/follow/route.ts', 'members/[id]/block/route.ts',
        'members/[id]/follows/route.ts', 'members/suggest/route.ts', 'messages/route.ts', 'messages/unread/route.ts',
        'messages/[id]/route.ts',
        'fitness/challenges/[id]/route.ts', 'fitness/checkins/route.ts', 'fitness/exercises/route.ts', 'fitness/metrics/[id]/route.ts',
        'fitness/metrics/route.ts', 'fitness/photos/[id]/route.ts', 'fitness/photos/route.ts', 'fitness/prefs/route.ts',
        'fitness/programs/[id]/route.ts', 'fitness/workouts/[id]/exercises/route.ts', 'fitness/workouts/[id]/finish/route.ts',
        'fitness/workouts/[id]/route.ts', 'fitness/workouts/[id]/sets/[setId]/route.ts', 'fitness/workouts/[id]/sets/route.ts',
        'fitness/workouts/route.ts',
      ].sort(),
    )
  })

  it('every exported handler of every clubhouse + clubhouse-admin route has a gating case', () => {
    // Integration guard: four builders each added routes. A route file being
    // listed is not enough — every method it exports must be exercised by a
    // CASE / ADMIN_CASE above (found through its import alias in this file).
    const src = readFileSync(__filename, 'utf8')
    const apiRoot = path.resolve(__dirname, '../../src/app/api')
    const missing: string[] = []
    const walk = (d: string, out: string[]) => {
      for (const f of readdirSync(d)) {
        const p = path.join(d, f)
        if (statSync(p).isDirectory()) walk(p, out)
        else if (f === 'route.ts') out.push(p)
      }
      return out
    }
    const files = [...walk(path.join(apiRoot, 'vip'), []), ...walk(path.join(apiRoot, 'admin', 'vip'), [])]
    for (const file of files) {
      const rel = path.relative(apiRoot, file).replace(/\\/g, '/').replace(/\/route\.ts$/, '')
      if (rel.startsWith('vip/auth/') || rel.startsWith('vip/partner-portal')) continue
      const alias = new RegExp(`import \\* as (\\w+) from '@/app/api/${rel.replace(/[.[\]]/g, (c) => `\\${c}`)}/route'`).exec(src)?.[1]
      if (!alias) {
        missing.push(`${rel} (not imported)`)
        continue
      }
      const methods = [...readFileSync(file, 'utf8').matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1])
      for (const m of methods) {
        if (rel === 'vip/email-prefs' && m === 'POST') continue // signed one-click opt-out, see above
        if (!src.includes(`${alias}.${m})`)) missing.push(`${m} ${rel}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('signed out → 401 everywhere', async () => {
    setSession(null)
    for (const c of CASES) {
      const res = await c.run()
      expect(res.status, c.name).toBe(401)
      expect(res.headers.get('cache-control'), c.name).toContain('no-store')
      expect(res.headers.get('x-robots-tag'), c.name).toContain('noindex')
    }
  })

  for (const who of ['none', 'pending', 'pastDue', 'cancelled'] as const) {
    it(`no active membership (${who}) → 403 everywhere`, async () => {
      setSession(users[who])
      for (const c of CASES) {
        const res = await c.run()
        expect(res.status, `${who} ${c.name}`).toBe(403)
        expect((await res.json()).error, c.name).toBe('membership_required')
      }
    })
  }

  it('community-suspended member → 403 on community APIs, still allowed on member APIs', async () => {
    setSession(users.suspended)
    for (const c of CASES) {
      const res = await c.run()
      if (c.gate === 'community') {
        expect(res.status, c.name).toBe(403)
        expect((await res.json()).error, c.name).toBe('community_suspended')
      } else {
        expect(c.passed ?? [200, 201, 404], c.name).toContain(res.status)
      }
    }
  })

  it('active member → passes the gate everywhere (never 401/403 from the gate)', async () => {
    setSession(users.member)
    for (const c of CASES) {
      const res = await c.run()
      expect([401].includes(res.status), c.name).toBe(false)
      if (res.status === 403) {
        // only an ownership check may 403 an active member (editing someone else's post)
        expect(['PATCH /posts/:id', 'DELETE /posts/:id'], c.name).toContain(c.name)
      }
    }
  })

  it('admin APIs → 401 for members and signed-out users', async () => {
    for (const who of [null, users.member]) {
      setSession(who)
      for (const c of ADMIN_CASES) {
        expect((await c.run()).status, `${who ? 'member' : 'anon'} ${c.name}`).toBe(401)
      }
    }
  })

  it('pages: signed out → /signin, non-member → /, suspended → /suspended on community pages', async () => {
    const redirectOf = async () => {
      try {
        await requireVipPage('community')
        return null
      } catch (e) {
        const digest = String((e as { digest?: string }).digest || '')
        return digest.split(';')[2] ?? digest
      }
    }
    setSession(null)
    expect(await redirectOf()).toBe('/signin')
    setSession(users.pastDue)
    expect(await redirectOf()).toBe('/')
    setSession(users.suspended)
    expect(await redirectOf()).toBe('/suspended')
    setSession(users.member)
    expect(await redirectOf()).toBeNull()
  })
})
