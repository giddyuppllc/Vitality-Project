-- 002_vip_platform.sql — the vitalityproject.vip platform (shared points
-- ledger, rewards + partner network, Academy, social network, fitness)
--
-- ADDITIVE ONLY, on top of 001 (which production already has):
--   • enum values added to "LoyaltyTxType" (new ledger movement kinds);
--   • two NULLABLE columns on "loyalty_transactions" ("idempotencyKey",
--     "source") + a plain index on "idempotencyKey". Exactly-once is enforced
--     by the NEW table "loyalty_tx_keys" (primary key = the idempotency key),
--     NOT by a unique constraint on loyalty_transactions — adding one to that
--     populated table would make the deploy's `prisma db push` stop and ask
--     for --accept-data-loss;
--   • nullable or defaulted columns on existing vip_* tables;
--   • new enum types, new tables (vip_* and loyalty_tx_keys), their indexes
--     and foreign keys.
-- No existing column is altered or dropped, no row is updated or deleted.
-- Idempotent: every statement is guarded (IF NOT EXISTS / duplicate_object /
-- pg_constraint lookup), so running it twice is a no-op.
--
-- Generated with `prisma migrate diff` (origin/master schema → this branch's
-- schema.prisma), then made idempotent and hand-checked. Verified by
-- `npm run verify:vip-migration`: a throwaway database built from
-- origin/master's schema gets 001 and 002 applied TWICE each, and
-- `prisma migrate diff` against schema.prisma must then be empty. The same
-- script proves the deploy path: `prisma db push --skip-generate` WITHOUT
-- --accept-data-loss onto a master-schema database holding rows.
--
-- Apply order (production): back up Neon, then this file, then deploy. The
-- deploy's `prisma db push --skip-generate` then finds nothing to change. If
-- this file is skipped, that push creates the same objects (all additive).
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/migrations-manual/002_vip_platform.sql

-- Enum values first, outside the transaction (ADD VALUE cannot be used in the
-- same transaction that adds it; nothing below uses them).
-- AlterEnum
ALTER TYPE "LoyaltyTxType" ADD VALUE IF NOT EXISTS 'EARN_ENGAGEMENT';
ALTER TYPE "LoyaltyTxType" ADD VALUE IF NOT EXISTS 'EARN_PARTNER';
ALTER TYPE "LoyaltyTxType" ADD VALUE IF NOT EXISTS 'REDEEM_REWARD';
ALTER TYPE "LoyaltyTxType" ADD VALUE IF NOT EXISTS 'REDEEM_PARTNER';
ALTER TYPE "LoyaltyTxType" ADD VALUE IF NOT EXISTS 'REVERSAL';

BEGIN;

-- ─── New enum types ────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "VipRewardKind" AS ENUM ('STORE_CREDIT', 'PRODUCT', 'MERCH', 'TRAINING', 'EXPERIENCE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "VipRedemptionStatus" AS ENUM ('REQUESTED', 'APPROVED', 'FULFILLED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "VipPartnerTxnKind" AS ENUM ('EARN', 'REDEEM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "VipStatementStatus" AS ENUM ('DRAFT', 'ISSUED', 'SETTLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "VipUnits" AS ENUM ('IMPERIAL', 'METRIC');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "VipExerciseMeasure" AS ENUM ('WEIGHT_REPS', 'REPS', 'TIME');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "VipEnrollmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "VipChallengeMetric" AS ENUM ('WORKOUTS', 'STEPS', 'CHECKIN_STREAK', 'CUSTOM_POINTS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "VipArticleCategory" AS ENUM ('NUTRITION', 'RECOVERY', 'SLEEP', 'MINDSET', 'RECIPES');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── New nullable / defaulted columns on existing tables ───────────────────
ALTER TABLE "loyalty_transactions" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
ADD COLUMN IF NOT EXISTS "source" TEXT;

ALTER TABLE "vip_profiles" ADD COLUMN IF NOT EXISTS "coverUrl" TEXT,
ADD COLUMN IF NOT EXISTS "dmPolicy" TEXT,
ADD COLUMN IF NOT EXISTS "hideFromLeaderboards" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "location" TEXT,
ADD COLUMN IF NOT EXISTS "profileVisibility" TEXT;

ALTER TABLE "vip_posts" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT;

ALTER TABLE "vip_reports" ADD COLUMN IF NOT EXISTS "conversationId" TEXT,
ADD COLUMN IF NOT EXISTS "messageId" TEXT;

ALTER TABLE "vip_notifications" ADD COLUMN IF NOT EXISTS "conversationId" TEXT;

ALTER TABLE "vip_courses" ADD COLUMN IF NOT EXISTS "estimatedMinutes" INTEGER,
ADD COLUMN IF NOT EXISTS "level" TEXT,
ADD COLUMN IF NOT EXISTS "pointsPrice" INTEGER,
ADD COLUMN IF NOT EXISTS "priceCents" INTEGER,
ADD COLUMN IF NOT EXISTS "purchaseOnly" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "trackId" TEXT;

ALTER TABLE "vip_lessons" ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER;

ALTER TABLE "vip_events" ADD COLUMN IF NOT EXISTS "capacity" INTEGER,
ADD COLUMN IF NOT EXISTS "kind" TEXT,
ADD COLUMN IF NOT EXISTS "recordingAddedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "recordingUrl" TEXT;

ALTER TABLE "vip_event_rsvps" ADD COLUMN IF NOT EXISTS "promotedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'GOING';

-- ─── New tables ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "loyalty_tx_keys" (
    "key" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_tx_keys_pkey" PRIMARY KEY ("key")
);

CREATE TABLE IF NOT EXISTS "vip_member_cards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_member_cards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_reward_items" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "VipRewardKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "pointsCost" INTEGER NOT NULL,
    "creditCents" INTEGER,
    "productId" TEXT,
    "variantId" TEXT,
    "courseId" TEXT,
    "stock" INTEGER,
    "perMemberLimit" INTEGER,
    "minTier" "MembershipTier" NOT NULL DEFAULT 'CLUB',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_reward_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_reward_options" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "stock" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "vip_reward_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_redemptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "optionId" TEXT,
    "kind" "VipRewardKind" NOT NULL,
    "title" TEXT NOT NULL,
    "optionLabel" TEXT,
    "pointsSpent" INTEGER NOT NULL,
    "status" "VipRedemptionStatus" NOT NULL DEFAULT 'REQUESTED',
    "idempotencyKey" TEXT NOT NULL,
    "spendTxnId" TEXT,
    "refundTxnId" TEXT,
    "storeCreditTxnId" TEXT,
    "shippingAddress" TEXT,
    "memberNote" TEXT,
    "adminNote" TEXT,
    "trackingNumber" TEXT,
    "approvedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "handledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_tracks" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "category" TEXT NOT NULL DEFAULT 'FOUNDATIONS',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_tracks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_course_grants" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_course_grants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_user_badges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_user_badges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_referrals" (
    "id" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3),
    "awardTxnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_referrals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_partners" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "website" TEXT,
    "address" TEXT,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "earnPointsPerDollar" INTEGER NOT NULL DEFAULT 5,
    "allowRedemption" BOOLEAN NOT NULL DEFAULT true,
    "networkFeeBps" INTEGER NOT NULL DEFAULT 500,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_partners_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_partner_staff" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_partner_staff_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_partner_txns" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "memberUserId" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "kind" "VipPartnerTxnKind" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "receiptRef" TEXT,
    "ledgerTxnId" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "voidLedgerTxnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_partner_txns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_partner_redeem_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "partnerTxnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_partner_redeem_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_partner_statements" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" "VipStatementStatus" NOT NULL DEFAULT 'DRAFT',
    "turnoverCents" INTEGER NOT NULL DEFAULT 0,
    "feeBps" INTEGER NOT NULL DEFAULT 0,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "pointsIssued" INTEGER NOT NULL DEFAULT 0,
    "pointsIssuedCents" INTEGER NOT NULL DEFAULT 0,
    "pointsRedeemed" INTEGER NOT NULL DEFAULT 0,
    "pointsRedeemedCents" INTEGER NOT NULL DEFAULT 0,
    "netCents" INTEGER NOT NULL DEFAULT 0,
    "earnCount" INTEGER NOT NULL DEFAULT 0,
    "redeemCount" INTEGER NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "settlementRef" TEXT,
    "settledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_partner_statements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_files" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_files_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_lesson_resources" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'FILE',
    "url" TEXT,
    "fileId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_lesson_resources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_quizzes" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "intro" TEXT,
    "passPct" INTEGER NOT NULL DEFAULT 70,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_quizzes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_quiz_questions" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_quiz_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_quiz_attempts" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "correct" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "scorePct" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_quiz_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_certificates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "courseTitle" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_certificates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_lesson_notes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_lesson_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_course_resumes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_course_resumes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_resources" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "category" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT,
    "fileId" TEXT,
    "minTier" "MembershipTier" NOT NULL DEFAULT 'CLUB',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "eventId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_resources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_onboarding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "interests" TEXT[],
    "goals" TEXT[],
    "trackId" TEXT,
    "completedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_onboarding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_follows" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_follows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_blocks" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_blocks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_interests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "vip_interests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_post_images" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "vip_post_images_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_post_hashtags" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_post_hashtags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_bookmarks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_bookmarks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_conversations" (
    "id" TEXT NOT NULL,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "directKey" TEXT,
    "createdById" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_conversation_participants" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "vip_conversation_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "sharedPostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_fitness_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "units" "VipUnits" NOT NULL DEFAULT 'IMPERIAL',
    "timeZone" TEXT,
    "hideFromLeaderboards" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_fitness_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_exercises" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "muscleGroups" TEXT[],
    "equipment" TEXT[],
    "measure" "VipExerciseMeasure" NOT NULL DEFAULT 'WEIGHT_REPS',
    "instructions" TEXT NOT NULL DEFAULT '',
    "videoUrl" TEXT,
    "imageUrl" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_exercises_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_programs" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "coverImage" TEXT,
    "level" TEXT,
    "minTier" "MembershipTier" NOT NULL DEFAULT 'CLUB',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_programs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_program_weeks" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "title" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_program_weeks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_program_days" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "isRest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_program_days_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_program_workouts" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_program_workouts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_program_prescriptions" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "sets" INTEGER NOT NULL DEFAULT 3,
    "reps" TEXT,
    "durationSec" INTEGER,
    "restSec" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_program_prescriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_program_enrollments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "status" "VipEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_program_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_program_day_completions" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "workoutLogId" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_program_day_completions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_workout_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "programDayId" TEXT,
    "exerciseOrder" TEXT[],
    "notes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "localDate" TEXT,
    "durationSec" INTEGER,
    "totalVolumeKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSets" INTEGER NOT NULL DEFAULT 0,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "prSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_workout_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_workout_sets" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "reps" INTEGER,
    "durationSec" INTEGER,
    "rpe" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_workout_sets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_personal_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "setId" TEXT,
    "achievedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_personal_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_checkins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "waterMl" INTEGER,
    "sleepHours" DOUBLE PRECISION,
    "steps" INTEGER,
    "mood" INTEGER,
    "energy" INTEGER,
    "workoutDone" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_checkins_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_body_metrics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "bodyFatPct" DOUBLE PRECISION,
    "waistCm" DOUBLE PRECISION,
    "chestCm" DOUBLE PRECISION,
    "hipsCm" DOUBLE PRECISION,
    "armCm" DOUBLE PRECISION,
    "thighCm" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_body_metrics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_progress_photos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "pose" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_progress_photos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_challenges" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "coverImage" TEXT,
    "metric" "VipChallengeMetric" NOT NULL,
    "target" INTEGER NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "minTier" "MembershipTier" NOT NULL DEFAULT 'CLUB',
    "pointsReward" INTEGER NOT NULL DEFAULT 0,
    "badgeLabel" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_challenges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_challenge_participants" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customScore" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "vip_challenge_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vip_articles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "coverImage" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "category" "VipArticleCategory" NOT NULL,
    "minTier" "MembershipTier" NOT NULL DEFAULT 'CLUB',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_articles_pkey" PRIMARY KEY ("id")
);

-- ─── Indexes ────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_tx_keys_transactionId_key" ON "loyalty_tx_keys"("transactionId");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_member_cards_userId_key" ON "vip_member_cards"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_member_cards_memberNumber_key" ON "vip_member_cards"("memberNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_reward_items_slug_key" ON "vip_reward_items"("slug");
CREATE INDEX IF NOT EXISTS "vip_reward_items_active_sortOrder_idx" ON "vip_reward_items"("active", "sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_reward_options_itemId_label_key" ON "vip_reward_options"("itemId", "label");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_redemptions_idempotencyKey_key" ON "vip_redemptions"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_redemptions_spendTxnId_key" ON "vip_redemptions"("spendTxnId");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_redemptions_refundTxnId_key" ON "vip_redemptions"("refundTxnId");
CREATE INDEX IF NOT EXISTS "vip_redemptions_userId_createdAt_idx" ON "vip_redemptions"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "vip_redemptions_status_createdAt_idx" ON "vip_redemptions"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "vip_redemptions_itemId_userId_idx" ON "vip_redemptions"("itemId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_tracks_slug_key" ON "vip_tracks"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_course_grants_userId_courseId_key" ON "vip_course_grants"("userId", "courseId");
CREATE INDEX IF NOT EXISTS "vip_user_badges_userId_awardedAt_idx" ON "vip_user_badges"("userId", "awardedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_user_badges_userId_badgeKey_key" ON "vip_user_badges"("userId", "badgeKey");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_referrals_referredUserId_key" ON "vip_referrals"("referredUserId");
CREATE INDEX IF NOT EXISTS "vip_referrals_referrerUserId_idx" ON "vip_referrals"("referrerUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_partners_slug_key" ON "vip_partners"("slug");
CREATE INDEX IF NOT EXISTS "vip_partner_staff_userId_idx" ON "vip_partner_staff"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_partner_staff_partnerId_userId_key" ON "vip_partner_staff"("partnerId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_partner_txns_ledgerTxnId_key" ON "vip_partner_txns"("ledgerTxnId");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_partner_txns_voidLedgerTxnId_key" ON "vip_partner_txns"("voidLedgerTxnId");
CREATE INDEX IF NOT EXISTS "vip_partner_txns_partnerId_createdAt_idx" ON "vip_partner_txns"("partnerId", "createdAt");
CREATE INDEX IF NOT EXISTS "vip_partner_txns_memberUserId_createdAt_idx" ON "vip_partner_txns"("memberUserId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_partner_txns_partnerId_receiptRef_key" ON "vip_partner_txns"("partnerId", "receiptRef");
CREATE INDEX IF NOT EXISTS "vip_partner_redeem_codes_userId_partnerId_expiresAt_idx" ON "vip_partner_redeem_codes"("userId", "partnerId", "expiresAt");
CREATE INDEX IF NOT EXISTS "vip_partner_statements_period_idx" ON "vip_partner_statements"("period");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_partner_statements_partnerId_period_key" ON "vip_partner_statements"("partnerId", "period");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_files_storageKey_key" ON "vip_files"("storageKey");
CREATE INDEX IF NOT EXISTS "vip_lesson_resources_lessonId_sortOrder_idx" ON "vip_lesson_resources"("lessonId", "sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_quizzes_moduleId_key" ON "vip_quizzes"("moduleId");
CREATE INDEX IF NOT EXISTS "vip_quiz_questions_quizId_sortOrder_idx" ON "vip_quiz_questions"("quizId", "sortOrder");
CREATE INDEX IF NOT EXISTS "vip_quiz_attempts_quizId_userId_idx" ON "vip_quiz_attempts"("quizId", "userId");
CREATE INDEX IF NOT EXISTS "vip_quiz_attempts_userId_createdAt_idx" ON "vip_quiz_attempts"("userId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_certificates_code_key" ON "vip_certificates"("code");
CREATE INDEX IF NOT EXISTS "vip_certificates_userId_idx" ON "vip_certificates"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_certificates_userId_courseId_key" ON "vip_certificates"("userId", "courseId");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_lesson_notes_userId_lessonId_key" ON "vip_lesson_notes"("userId", "lessonId");
CREATE INDEX IF NOT EXISTS "vip_course_resumes_userId_updatedAt_idx" ON "vip_course_resumes"("userId", "updatedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_course_resumes_userId_courseId_key" ON "vip_course_resumes"("userId", "courseId");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_resources_eventId_key" ON "vip_resources"("eventId");
CREATE INDEX IF NOT EXISTS "vip_resources_published_category_idx" ON "vip_resources"("published", "category");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_onboarding_userId_key" ON "vip_onboarding"("userId");
CREATE INDEX IF NOT EXISTS "vip_follows_followingId_createdAt_idx" ON "vip_follows"("followingId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_follows_followerId_followingId_key" ON "vip_follows"("followerId", "followingId");
CREATE INDEX IF NOT EXISTS "vip_blocks_blockedId_idx" ON "vip_blocks"("blockedId");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_blocks_blockerId_blockedId_key" ON "vip_blocks"("blockerId", "blockedId");
CREATE INDEX IF NOT EXISTS "vip_interests_tag_idx" ON "vip_interests"("tag");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_interests_userId_tag_key" ON "vip_interests"("userId", "tag");
CREATE INDEX IF NOT EXISTS "vip_post_images_postId_sortOrder_idx" ON "vip_post_images"("postId", "sortOrder");
CREATE INDEX IF NOT EXISTS "vip_post_hashtags_tag_createdAt_idx" ON "vip_post_hashtags"("tag", "createdAt");
CREATE INDEX IF NOT EXISTS "vip_post_hashtags_createdAt_idx" ON "vip_post_hashtags"("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_post_hashtags_postId_tag_key" ON "vip_post_hashtags"("postId", "tag");
CREATE INDEX IF NOT EXISTS "vip_bookmarks_userId_createdAt_idx" ON "vip_bookmarks"("userId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_bookmarks_userId_postId_key" ON "vip_bookmarks"("userId", "postId");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_conversations_directKey_key" ON "vip_conversations"("directKey");
CREATE INDEX IF NOT EXISTS "vip_conversations_lastMessageAt_idx" ON "vip_conversations"("lastMessageAt");
CREATE INDEX IF NOT EXISTS "vip_conversation_participants_userId_idx" ON "vip_conversation_participants"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_conversation_participants_conversationId_userId_key" ON "vip_conversation_participants"("conversationId", "userId");
CREATE INDEX IF NOT EXISTS "vip_messages_conversationId_createdAt_idx" ON "vip_messages"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "vip_messages_senderId_createdAt_idx" ON "vip_messages"("senderId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_fitness_profiles_userId_key" ON "vip_fitness_profiles"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_exercises_slug_key" ON "vip_exercises"("slug");
CREATE INDEX IF NOT EXISTS "vip_exercises_name_idx" ON "vip_exercises"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_programs_slug_key" ON "vip_programs"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_program_weeks_programId_weekNumber_key" ON "vip_program_weeks"("programId", "weekNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_program_days_weekId_dayNumber_key" ON "vip_program_days"("weekId", "dayNumber");
CREATE INDEX IF NOT EXISTS "vip_program_workouts_dayId_sortOrder_idx" ON "vip_program_workouts"("dayId", "sortOrder");
CREATE INDEX IF NOT EXISTS "vip_program_prescriptions_workoutId_sortOrder_idx" ON "vip_program_prescriptions"("workoutId", "sortOrder");
CREATE INDEX IF NOT EXISTS "vip_program_enrollments_userId_status_idx" ON "vip_program_enrollments"("userId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_program_enrollments_userId_programId_key" ON "vip_program_enrollments"("userId", "programId");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_program_day_completions_enrollmentId_dayId_key" ON "vip_program_day_completions"("enrollmentId", "dayId");
CREATE INDEX IF NOT EXISTS "vip_workout_logs_userId_finishedAt_idx" ON "vip_workout_logs"("userId", "finishedAt");
CREATE INDEX IF NOT EXISTS "vip_workout_logs_userId_localDate_idx" ON "vip_workout_logs"("userId", "localDate");
CREATE INDEX IF NOT EXISTS "vip_workout_sets_logId_exerciseId_setNumber_idx" ON "vip_workout_sets"("logId", "exerciseId", "setNumber");
CREATE INDEX IF NOT EXISTS "vip_workout_sets_exerciseId_idx" ON "vip_workout_sets"("exerciseId");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_personal_records_userId_exerciseId_kind_key" ON "vip_personal_records"("userId", "exerciseId", "kind");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_checkins_userId_date_key" ON "vip_checkins"("userId", "date");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_body_metrics_userId_date_key" ON "vip_body_metrics"("userId", "date");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_progress_photos_fileKey_key" ON "vip_progress_photos"("fileKey");
CREATE INDEX IF NOT EXISTS "vip_progress_photos_userId_date_idx" ON "vip_progress_photos"("userId", "date");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_challenges_slug_key" ON "vip_challenges"("slug");
CREATE INDEX IF NOT EXISTS "vip_challenge_participants_userId_idx" ON "vip_challenge_participants"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_challenge_participants_challengeId_userId_key" ON "vip_challenge_participants"("challengeId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "vip_articles_slug_key" ON "vip_articles"("slug");
CREATE INDEX IF NOT EXISTS "vip_articles_category_publishedAt_idx" ON "vip_articles"("category", "publishedAt");
CREATE INDEX IF NOT EXISTS "loyalty_transactions_accountId_createdAt_idx" ON "loyalty_transactions"("accountId", "createdAt");
CREATE INDEX IF NOT EXISTS "loyalty_transactions_idempotencyKey_idx" ON "loyalty_transactions"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "vip_reports_messageId_idx" ON "vip_reports"("messageId");
CREATE INDEX IF NOT EXISTS "vip_reports_conversationId_idx" ON "vip_reports"("conversationId");
CREATE INDEX IF NOT EXISTS "vip_courses_trackId_idx" ON "vip_courses"("trackId");

-- ─── Foreign keys ───────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_tx_keys_transactionId_fkey') THEN
    ALTER TABLE "loyalty_tx_keys" ADD CONSTRAINT "loyalty_tx_keys_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "loyalty_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_reports_messageId_fkey') THEN
    ALTER TABLE "vip_reports" ADD CONSTRAINT "vip_reports_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "vip_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_reports_conversationId_fkey') THEN
    ALTER TABLE "vip_reports" ADD CONSTRAINT "vip_reports_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "vip_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_courses_trackId_fkey') THEN
    ALTER TABLE "vip_courses" ADD CONSTRAINT "vip_courses_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "vip_tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_reward_options_itemId_fkey') THEN
    ALTER TABLE "vip_reward_options" ADD CONSTRAINT "vip_reward_options_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "vip_reward_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_redemptions_itemId_fkey') THEN
    ALTER TABLE "vip_redemptions" ADD CONSTRAINT "vip_redemptions_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "vip_reward_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_user_badges_userId_fkey') THEN
    ALTER TABLE "vip_user_badges" ADD CONSTRAINT "vip_user_badges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_partner_staff_partnerId_fkey') THEN
    ALTER TABLE "vip_partner_staff" ADD CONSTRAINT "vip_partner_staff_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "vip_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_partner_txns_partnerId_fkey') THEN
    ALTER TABLE "vip_partner_txns" ADD CONSTRAINT "vip_partner_txns_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "vip_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_partner_statements_partnerId_fkey') THEN
    ALTER TABLE "vip_partner_statements" ADD CONSTRAINT "vip_partner_statements_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "vip_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_lesson_resources_lessonId_fkey') THEN
    ALTER TABLE "vip_lesson_resources" ADD CONSTRAINT "vip_lesson_resources_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "vip_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_lesson_resources_fileId_fkey') THEN
    ALTER TABLE "vip_lesson_resources" ADD CONSTRAINT "vip_lesson_resources_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "vip_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_quizzes_moduleId_fkey') THEN
    ALTER TABLE "vip_quizzes" ADD CONSTRAINT "vip_quizzes_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "vip_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_quiz_questions_quizId_fkey') THEN
    ALTER TABLE "vip_quiz_questions" ADD CONSTRAINT "vip_quiz_questions_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "vip_quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_quiz_attempts_quizId_fkey') THEN
    ALTER TABLE "vip_quiz_attempts" ADD CONSTRAINT "vip_quiz_attempts_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "vip_quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_lesson_notes_lessonId_fkey') THEN
    ALTER TABLE "vip_lesson_notes" ADD CONSTRAINT "vip_lesson_notes_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "vip_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_course_resumes_courseId_fkey') THEN
    ALTER TABLE "vip_course_resumes" ADD CONSTRAINT "vip_course_resumes_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "vip_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_resources_fileId_fkey') THEN
    ALTER TABLE "vip_resources" ADD CONSTRAINT "vip_resources_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "vip_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_resources_eventId_fkey') THEN
    ALTER TABLE "vip_resources" ADD CONSTRAINT "vip_resources_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "vip_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_follows_followerId_fkey') THEN
    ALTER TABLE "vip_follows" ADD CONSTRAINT "vip_follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_follows_followingId_fkey') THEN
    ALTER TABLE "vip_follows" ADD CONSTRAINT "vip_follows_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_blocks_blockerId_fkey') THEN
    ALTER TABLE "vip_blocks" ADD CONSTRAINT "vip_blocks_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_blocks_blockedId_fkey') THEN
    ALTER TABLE "vip_blocks" ADD CONSTRAINT "vip_blocks_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_interests_userId_fkey') THEN
    ALTER TABLE "vip_interests" ADD CONSTRAINT "vip_interests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_post_images_postId_fkey') THEN
    ALTER TABLE "vip_post_images" ADD CONSTRAINT "vip_post_images_postId_fkey" FOREIGN KEY ("postId") REFERENCES "vip_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_post_hashtags_postId_fkey') THEN
    ALTER TABLE "vip_post_hashtags" ADD CONSTRAINT "vip_post_hashtags_postId_fkey" FOREIGN KEY ("postId") REFERENCES "vip_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_bookmarks_userId_fkey') THEN
    ALTER TABLE "vip_bookmarks" ADD CONSTRAINT "vip_bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_bookmarks_postId_fkey') THEN
    ALTER TABLE "vip_bookmarks" ADD CONSTRAINT "vip_bookmarks_postId_fkey" FOREIGN KEY ("postId") REFERENCES "vip_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_conversation_participants_conversationId_fkey') THEN
    ALTER TABLE "vip_conversation_participants" ADD CONSTRAINT "vip_conversation_participants_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "vip_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_conversation_participants_userId_fkey') THEN
    ALTER TABLE "vip_conversation_participants" ADD CONSTRAINT "vip_conversation_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_messages_conversationId_fkey') THEN
    ALTER TABLE "vip_messages" ADD CONSTRAINT "vip_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "vip_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_messages_senderId_fkey') THEN
    ALTER TABLE "vip_messages" ADD CONSTRAINT "vip_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_messages_sharedPostId_fkey') THEN
    ALTER TABLE "vip_messages" ADD CONSTRAINT "vip_messages_sharedPostId_fkey" FOREIGN KEY ("sharedPostId") REFERENCES "vip_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_fitness_profiles_userId_fkey') THEN
    ALTER TABLE "vip_fitness_profiles" ADD CONSTRAINT "vip_fitness_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_program_weeks_programId_fkey') THEN
    ALTER TABLE "vip_program_weeks" ADD CONSTRAINT "vip_program_weeks_programId_fkey" FOREIGN KEY ("programId") REFERENCES "vip_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_program_days_weekId_fkey') THEN
    ALTER TABLE "vip_program_days" ADD CONSTRAINT "vip_program_days_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "vip_program_weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_program_workouts_dayId_fkey') THEN
    ALTER TABLE "vip_program_workouts" ADD CONSTRAINT "vip_program_workouts_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "vip_program_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_program_prescriptions_workoutId_fkey') THEN
    ALTER TABLE "vip_program_prescriptions" ADD CONSTRAINT "vip_program_prescriptions_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "vip_program_workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_program_prescriptions_exerciseId_fkey') THEN
    ALTER TABLE "vip_program_prescriptions" ADD CONSTRAINT "vip_program_prescriptions_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "vip_exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_program_enrollments_userId_fkey') THEN
    ALTER TABLE "vip_program_enrollments" ADD CONSTRAINT "vip_program_enrollments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_program_enrollments_programId_fkey') THEN
    ALTER TABLE "vip_program_enrollments" ADD CONSTRAINT "vip_program_enrollments_programId_fkey" FOREIGN KEY ("programId") REFERENCES "vip_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_program_day_completions_enrollmentId_fkey') THEN
    ALTER TABLE "vip_program_day_completions" ADD CONSTRAINT "vip_program_day_completions_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "vip_program_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_program_day_completions_dayId_fkey') THEN
    ALTER TABLE "vip_program_day_completions" ADD CONSTRAINT "vip_program_day_completions_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "vip_program_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_workout_logs_userId_fkey') THEN
    ALTER TABLE "vip_workout_logs" ADD CONSTRAINT "vip_workout_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_workout_logs_enrollmentId_fkey') THEN
    ALTER TABLE "vip_workout_logs" ADD CONSTRAINT "vip_workout_logs_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "vip_program_enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_workout_logs_programDayId_fkey') THEN
    ALTER TABLE "vip_workout_logs" ADD CONSTRAINT "vip_workout_logs_programDayId_fkey" FOREIGN KEY ("programDayId") REFERENCES "vip_program_days"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_workout_sets_logId_fkey') THEN
    ALTER TABLE "vip_workout_sets" ADD CONSTRAINT "vip_workout_sets_logId_fkey" FOREIGN KEY ("logId") REFERENCES "vip_workout_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_workout_sets_exerciseId_fkey') THEN
    ALTER TABLE "vip_workout_sets" ADD CONSTRAINT "vip_workout_sets_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "vip_exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_personal_records_userId_fkey') THEN
    ALTER TABLE "vip_personal_records" ADD CONSTRAINT "vip_personal_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_personal_records_exerciseId_fkey') THEN
    ALTER TABLE "vip_personal_records" ADD CONSTRAINT "vip_personal_records_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "vip_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_personal_records_setId_fkey') THEN
    ALTER TABLE "vip_personal_records" ADD CONSTRAINT "vip_personal_records_setId_fkey" FOREIGN KEY ("setId") REFERENCES "vip_workout_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_checkins_userId_fkey') THEN
    ALTER TABLE "vip_checkins" ADD CONSTRAINT "vip_checkins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_body_metrics_userId_fkey') THEN
    ALTER TABLE "vip_body_metrics" ADD CONSTRAINT "vip_body_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_progress_photos_userId_fkey') THEN
    ALTER TABLE "vip_progress_photos" ADD CONSTRAINT "vip_progress_photos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_challenge_participants_challengeId_fkey') THEN
    ALTER TABLE "vip_challenge_participants" ADD CONSTRAINT "vip_challenge_participants_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "vip_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_challenge_participants_userId_fkey') THEN
    ALTER TABLE "vip_challenge_participants" ADD CONSTRAINT "vip_challenge_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
