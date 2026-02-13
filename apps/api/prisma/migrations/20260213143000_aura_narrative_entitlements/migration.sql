-- CreateEnum
CREATE TYPE "AuraTier" AS ENUM ('DORMANT', 'PRESENT', 'RESONANT', 'RADIANT', 'ASCENDANT');

-- CreateEnum
CREATE TYPE "AuraEventKind" AS ENUM ('MESSAGE_SENT', 'REACTION_RECEIVED', 'MENTIONED', 'VOICE_MINUTES', 'SESSION_HOSTED', 'SESSION_JOINED');

-- CreateEnum
CREATE TYPE "NarrativeRoomStatus" AS ENUM ('LOBBY', 'RUNNING', 'ENDED');

-- CreateEnum
CREATE TYPE "EntitlementKind" AS ENUM ('SUBSCRIBER', 'SERVER_PRO');

-- CreateEnum
CREATE TYPE "EntitlementSource" AS ENUM ('MANUAL', 'DEV');

-- CreateTable
CREATE TABLE "MaskAura" (
  "id" UUID NOT NULL,
  "maskId" UUID NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "tier" "AuraTier" NOT NULL DEFAULT 'DORMANT',
  "color" TEXT NOT NULL DEFAULT 'Gray',
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaskAura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuraEvent" (
  "id" UUID NOT NULL,
  "maskId" UUID NOT NULL,
  "kind" "AuraEventKind" NOT NULL,
  "weight" INTEGER NOT NULL,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuraEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NarrativeTemplate" (
  "id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "minPlayers" INTEGER NOT NULL,
  "maxPlayers" INTEGER NOT NULL,
  "phases" JSONB NOT NULL,
  "roles" JSONB NOT NULL,
  "requiresEntitlement" "EntitlementKind",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NarrativeTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NarrativeRoom" (
  "id" UUID NOT NULL,
  "templateId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "hostMaskId" UUID NOT NULL,
  "status" "NarrativeRoomStatus" NOT NULL DEFAULT 'LOBBY',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "NarrativeRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NarrativeMembership" (
  "id" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "maskId" UUID NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  CONSTRAINT "NarrativeMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NarrativeSessionState" (
  "roomId" UUID NOT NULL,
  "phaseIndex" INTEGER NOT NULL,
  "phaseEndsAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NarrativeSessionState_pkey" PRIMARY KEY ("roomId")
);

-- CreateTable
CREATE TABLE "NarrativeRoleAssignment" (
  "id" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "maskId" UUID NOT NULL,
  "roleKey" TEXT NOT NULL,
  "secretPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NarrativeRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NarrativeMessage" (
  "id" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "maskId" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NarrativeMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entitlement" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "kind" "EntitlementKind" NOT NULL,
  "source" "EntitlementSource" NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CosmeticUnlock" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CosmeticUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaskAura_maskId_key" ON "MaskAura"("maskId");

-- CreateIndex
CREATE INDEX "AuraEvent_maskId_kind_createdAt_idx" ON "AuraEvent"("maskId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "AuraEvent_maskId_createdAt_idx" ON "AuraEvent"("maskId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NarrativeTemplate_slug_key" ON "NarrativeTemplate"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "NarrativeRoom_code_key" ON "NarrativeRoom"("code");

-- CreateIndex
CREATE INDEX "NarrativeRoom_status_createdAt_idx" ON "NarrativeRoom"("status", "createdAt");

-- CreateIndex
CREATE INDEX "NarrativeRoom_hostMaskId_createdAt_idx" ON "NarrativeRoom"("hostMaskId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NarrativeMembership_roomId_maskId_key" ON "NarrativeMembership"("roomId", "maskId");

-- CreateIndex
CREATE INDEX "NarrativeMembership_roomId_joinedAt_idx" ON "NarrativeMembership"("roomId", "joinedAt");

-- CreateIndex
CREATE INDEX "NarrativeMembership_maskId_joinedAt_idx" ON "NarrativeMembership"("maskId", "joinedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NarrativeRoleAssignment_roomId_maskId_key" ON "NarrativeRoleAssignment"("roomId", "maskId");

-- CreateIndex
CREATE INDEX "NarrativeRoleAssignment_roomId_roleKey_idx" ON "NarrativeRoleAssignment"("roomId", "roleKey");

-- CreateIndex
CREATE INDEX "NarrativeMessage_roomId_createdAt_idx" ON "NarrativeMessage"("roomId", "createdAt");

-- CreateIndex
CREATE INDEX "Entitlement_userId_kind_expiresAt_idx" ON "Entitlement"("userId", "kind", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticUnlock_userId_key_key" ON "CosmeticUnlock"("userId", "key");

-- CreateIndex
CREATE INDEX "CosmeticUnlock_userId_unlockedAt_idx" ON "CosmeticUnlock"("userId", "unlockedAt");

-- AddForeignKey
ALTER TABLE "MaskAura"
  ADD CONSTRAINT "MaskAura_maskId_fkey"
  FOREIGN KEY ("maskId") REFERENCES "Mask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuraEvent"
  ADD CONSTRAINT "AuraEvent_maskId_fkey"
  FOREIGN KEY ("maskId") REFERENCES "Mask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarrativeRoom"
  ADD CONSTRAINT "NarrativeRoom_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "NarrativeTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarrativeRoom"
  ADD CONSTRAINT "NarrativeRoom_hostMaskId_fkey"
  FOREIGN KEY ("hostMaskId") REFERENCES "Mask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarrativeMembership"
  ADD CONSTRAINT "NarrativeMembership_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "NarrativeRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarrativeMembership"
  ADD CONSTRAINT "NarrativeMembership_maskId_fkey"
  FOREIGN KEY ("maskId") REFERENCES "Mask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarrativeSessionState"
  ADD CONSTRAINT "NarrativeSessionState_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "NarrativeRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarrativeRoleAssignment"
  ADD CONSTRAINT "NarrativeRoleAssignment_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "NarrativeRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarrativeRoleAssignment"
  ADD CONSTRAINT "NarrativeRoleAssignment_maskId_fkey"
  FOREIGN KEY ("maskId") REFERENCES "Mask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarrativeMessage"
  ADD CONSTRAINT "NarrativeMessage_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "NarrativeRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarrativeMessage"
  ADD CONSTRAINT "NarrativeMessage_maskId_fkey"
  FOREIGN KEY ("maskId") REFERENCES "Mask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement"
  ADD CONSTRAINT "Entitlement_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CosmeticUnlock"
  ADD CONSTRAINT "CosmeticUnlock_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
