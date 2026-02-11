-- CreateEnum
CREATE TYPE "VoiceContextType" AS ENUM ('SERVER_CHANNEL', 'DM_THREAD', 'EPHEMERAL_ROOM');

-- CreateTable
CREATE TABLE "VoiceSession" (
  "id" UUID NOT NULL,
  "contextType" "VoiceContextType" NOT NULL,
  "contextId" UUID NOT NULL,
  "livekitRoomName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "VoiceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceParticipant" (
  "id" UUID NOT NULL,
  "voiceSessionId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "maskId" UUID NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  "isServerMuted" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "VoiceParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoiceSession_livekitRoomName_key" ON "VoiceSession"("livekitRoomName");

-- CreateIndex
CREATE INDEX "VoiceSession_contextType_contextId_endedAt_idx" ON "VoiceSession"("contextType", "contextId", "endedAt");

-- CreateIndex
CREATE INDEX "VoiceParticipant_voiceSessionId_leftAt_joinedAt_idx" ON "VoiceParticipant"("voiceSessionId", "leftAt", "joinedAt");

-- CreateIndex
CREATE INDEX "VoiceParticipant_voiceSessionId_maskId_leftAt_idx" ON "VoiceParticipant"("voiceSessionId", "maskId", "leftAt");

-- CreateIndex
CREATE INDEX "VoiceParticipant_voiceSessionId_userId_leftAt_idx" ON "VoiceParticipant"("voiceSessionId", "userId", "leftAt");

-- AddForeignKey
ALTER TABLE "VoiceParticipant"
  ADD CONSTRAINT "VoiceParticipant_voiceSessionId_fkey"
  FOREIGN KEY ("voiceSessionId") REFERENCES "VoiceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceParticipant"
  ADD CONSTRAINT "VoiceParticipant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceParticipant"
  ADD CONSTRAINT "VoiceParticipant_maskId_fkey"
  FOREIGN KEY ("maskId") REFERENCES "Mask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;