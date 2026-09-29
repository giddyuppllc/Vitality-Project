-- 001_vip_clubhouse.sql — vitalityproject.vip members' clubhouse
--
-- ADDITIVE ONLY: one enum value + new vip_* tables, indexes and foreign keys.
-- No existing table or column is altered, no row is updated or deleted.
-- Idempotent: every statement is guarded (IF NOT EXISTS / pg_constraint
-- lookup), so running it twice is a no-op.
--
-- Twin of the Vip* models in prisma/schema.prisma. Verified equal by
-- `npm run verify:vip-migration` (applies this file twice to a throwaway
-- database built from origin/master's schema, then asserts
-- `prisma migrate diff` against schema.prisma is empty).
--
-- Apply order: this file BEFORE deploying the app build that uses it.
-- (The deploy's `prisma db push` would also create these objects; applying
-- this first makes that push a no-op and lets you review the change.)
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/migrations-manual/001_vip_clubhouse.sql

-- Enum value first, outside the transaction (ADD VALUE cannot be used in the
-- same transaction that adds it; nothing below uses it).
-- AlterEnum
ALTER TYPE "CreditTxType" ADD VALUE IF NOT EXISTS 'MEMBER_REWARD';

BEGIN;

-- CreateTable
CREATE TABLE IF NOT EXISTS "vip_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "suspendedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vip_spaces" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "adminOnly" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vip_posts" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "spaceId" TEXT,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "isAnnouncement" BOOLEAN NOT NULL DEFAULT false,
    "hiddenAt" TIMESTAMP(3),
    "hiddenById" TEXT,
    "hiddenReason" TEXT,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vip_comments" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "hiddenAt" TIMESTAMP(3),
    "hiddenById" TEXT,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vip_reactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT,
    "commentId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'LIKE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vip_reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "postId" TEXT,
    "commentId" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vip_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT,
    "postId" TEXT,
    "commentId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vip_courses" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "coverImage" TEXT,
    "minTier" "MembershipTier" NOT NULL DEFAULT 'CLUB',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vip_modules" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vip_lessons" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "videoUrl" TEXT,
    "minTier" "MembershipTier",
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vip_lesson_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vip_events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "joinUrl" TEXT,
    "minTier" "MembershipTier" NOT NULL DEFAULT 'CLUB',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vip_event_rsvps" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_event_rsvps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vip_tier_rewards" (
    "tier" "MembershipTier" NOT NULL,
    "monthlyCreditCents" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_tier_rewards_pkey" PRIMARY KEY ("tier")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vip_reward_grants" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "tier" "MembershipTier" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "storeCreditTxnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_reward_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vip_sso_consumed_tokens" (
    "jti" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_sso_consumed_tokens_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vip_profiles_userId_key" ON "vip_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vip_spaces_slug_key" ON "vip_spaces"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vip_posts_createdAt_idx" ON "vip_posts"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vip_posts_spaceId_createdAt_idx" ON "vip_posts"("spaceId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vip_posts_authorId_idx" ON "vip_posts"("authorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vip_comments_postId_createdAt_idx" ON "vip_comments"("postId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vip_comments_authorId_idx" ON "vip_comments"("authorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vip_reactions_postId_idx" ON "vip_reactions"("postId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vip_reactions_commentId_idx" ON "vip_reactions"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vip_reactions_userId_postId_kind_key" ON "vip_reactions"("userId", "postId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vip_reactions_userId_commentId_kind_key" ON "vip_reactions"("userId", "commentId", "kind");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vip_reports_status_createdAt_idx" ON "vip_reports"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vip_reports_reporterId_postId_key" ON "vip_reports"("reporterId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vip_reports_reporterId_commentId_key" ON "vip_reports"("reporterId", "commentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vip_notifications_userId_readAt_createdAt_idx" ON "vip_notifications"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vip_courses_slug_key" ON "vip_courses"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vip_modules_courseId_sortOrder_idx" ON "vip_modules"("courseId", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vip_lessons_moduleId_sortOrder_idx" ON "vip_lessons"("moduleId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vip_lesson_progress_userId_lessonId_key" ON "vip_lesson_progress"("userId", "lessonId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vip_events_startsAt_idx" ON "vip_events"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vip_event_rsvps_eventId_userId_key" ON "vip_event_rsvps"("eventId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vip_reward_grants_period_idx" ON "vip_reward_grants"("period");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vip_reward_grants_userId_period_key" ON "vip_reward_grants"("userId", "period");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vip_sso_consumed_tokens_expiresAt_idx" ON "vip_sso_consumed_tokens"("expiresAt");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_profiles_userId_fkey') THEN
    ALTER TABLE "vip_profiles" ADD CONSTRAINT "vip_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_posts_authorId_fkey') THEN
    ALTER TABLE "vip_posts" ADD CONSTRAINT "vip_posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_posts_spaceId_fkey') THEN
    ALTER TABLE "vip_posts" ADD CONSTRAINT "vip_posts_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "vip_spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_comments_postId_fkey') THEN
    ALTER TABLE "vip_comments" ADD CONSTRAINT "vip_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "vip_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_comments_authorId_fkey') THEN
    ALTER TABLE "vip_comments" ADD CONSTRAINT "vip_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_comments_parentId_fkey') THEN
    ALTER TABLE "vip_comments" ADD CONSTRAINT "vip_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "vip_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_reactions_postId_fkey') THEN
    ALTER TABLE "vip_reactions" ADD CONSTRAINT "vip_reactions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "vip_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_reactions_commentId_fkey') THEN
    ALTER TABLE "vip_reactions" ADD CONSTRAINT "vip_reactions_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "vip_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_reactions_userId_fkey') THEN
    ALTER TABLE "vip_reactions" ADD CONSTRAINT "vip_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_reports_reporterId_fkey') THEN
    ALTER TABLE "vip_reports" ADD CONSTRAINT "vip_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_reports_postId_fkey') THEN
    ALTER TABLE "vip_reports" ADD CONSTRAINT "vip_reports_postId_fkey" FOREIGN KEY ("postId") REFERENCES "vip_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_reports_commentId_fkey') THEN
    ALTER TABLE "vip_reports" ADD CONSTRAINT "vip_reports_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "vip_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_notifications_userId_fkey') THEN
    ALTER TABLE "vip_notifications" ADD CONSTRAINT "vip_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_modules_courseId_fkey') THEN
    ALTER TABLE "vip_modules" ADD CONSTRAINT "vip_modules_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "vip_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_lessons_moduleId_fkey') THEN
    ALTER TABLE "vip_lessons" ADD CONSTRAINT "vip_lessons_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "vip_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_lesson_progress_lessonId_fkey') THEN
    ALTER TABLE "vip_lesson_progress" ADD CONSTRAINT "vip_lesson_progress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "vip_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_lesson_progress_userId_fkey') THEN
    ALTER TABLE "vip_lesson_progress" ADD CONSTRAINT "vip_lesson_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_event_rsvps_eventId_fkey') THEN
    ALTER TABLE "vip_event_rsvps" ADD CONSTRAINT "vip_event_rsvps_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "vip_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_event_rsvps_userId_fkey') THEN
    ALTER TABLE "vip_event_rsvps" ADD CONSTRAINT "vip_event_rsvps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_reward_grants_userId_fkey') THEN
    ALTER TABLE "vip_reward_grants" ADD CONSTRAINT "vip_reward_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
