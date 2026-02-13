-- Add server-level RTC policy fields
ALTER TABLE "Server"
  ADD COLUMN "stageModeEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "screenshareMinimumRole" "ServerMembershipRole" NOT NULL DEFAULT 'MEMBER';

-- Add deterministic seed and ready state for narrative rooms
ALTER TABLE "NarrativeRoom"
  ADD COLUMN "seed" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "NarrativeMembership"
  ADD COLUMN "isReady" BOOLEAN NOT NULL DEFAULT false;

-- Replace entitlement kind enum values with plan-aligned values.
ALTER TYPE "EntitlementKind" RENAME TO "EntitlementKind_old";
CREATE TYPE "EntitlementKind" AS ENUM ('FREE', 'PRO');

ALTER TABLE "Entitlement"
  ALTER COLUMN "kind" TYPE "EntitlementKind"
  USING (
    CASE "kind"::text
      WHEN 'SUBSCRIBER' THEN 'PRO'
      WHEN 'SERVER_PRO' THEN 'PRO'
      ELSE 'FREE'
    END
  )::"EntitlementKind";

ALTER TABLE "NarrativeTemplate"
  ALTER COLUMN "requiresEntitlement" TYPE "EntitlementKind"
  USING (
    CASE "requiresEntitlement"::text
      WHEN 'SUBSCRIBER' THEN 'PRO'
      WHEN 'SERVER_PRO' THEN 'PRO'
      ELSE NULL
    END
  )::"EntitlementKind";

DROP TYPE "EntitlementKind_old";

-- Replace entitlement source enum values for Stripe/dev-manual scaffolding.
ALTER TYPE "EntitlementSource" RENAME TO "EntitlementSource_old";
CREATE TYPE "EntitlementSource" AS ENUM ('STRIPE', 'DEV_MANUAL');

ALTER TABLE "Entitlement"
  ALTER COLUMN "source" TYPE "EntitlementSource"
  USING (
    CASE "source"::text
      WHEN 'MANUAL' THEN 'DEV_MANUAL'
      WHEN 'DEV' THEN 'DEV_MANUAL'
      ELSE 'DEV_MANUAL'
    END
  )::"EntitlementSource";

DROP TYPE "EntitlementSource_old";

-- Persist per-user RTC preferences (privacy-safe controls, no recording).
CREATE TABLE "UserRtcSettings" (
  "userId" UUID NOT NULL,
  "advancedNoiseSuppression" BOOLEAN NOT NULL DEFAULT false,
  "pushToTalkMode" TEXT NOT NULL DEFAULT 'HOLD',
  "pushToTalkHotkey" TEXT NOT NULL DEFAULT 'V',
  "multiPinEnabled" BOOLEAN NOT NULL DEFAULT false,
  "pictureInPictureEnabled" BOOLEAN NOT NULL DEFAULT false,
  "defaultScreenshareFps" INTEGER NOT NULL DEFAULT 30,
  "defaultScreenshareQuality" TEXT NOT NULL DEFAULT 'balanced',
  "cursorHighlight" BOOLEAN NOT NULL DEFAULT true,
  "selectedAuraStyle" TEXT NOT NULL DEFAULT 'AURA_STYLE_BASE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserRtcSettings_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "UserRtcSettings"
  ADD CONSTRAINT "UserRtcSettings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
