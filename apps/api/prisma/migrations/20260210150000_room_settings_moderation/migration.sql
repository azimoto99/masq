-- CreateEnum
CREATE TYPE "RoomModerationActionType" AS ENUM ('MUTE', 'EXILE');

-- AlterTable
ALTER TABLE "Room"
  ADD COLUMN "locked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "fogLevel" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "messageDecayMinutes" INTEGER NOT NULL DEFAULT 8;

-- CreateTable
CREATE TABLE "RoomModeration" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "roomId" UUID NOT NULL,
  "targetMaskId" UUID NOT NULL,
  "actionType" "RoomModerationActionType" NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorMaskId" UUID NOT NULL,
  CONSTRAINT "RoomModeration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomModeration_roomId_targetMaskId_actionType_expiresAt_idx"
  ON "RoomModeration"("roomId", "targetMaskId", "actionType", "expiresAt");

-- AddForeignKey
ALTER TABLE "RoomModeration"
  ADD CONSTRAINT "RoomModeration_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomModeration"
  ADD CONSTRAINT "RoomModeration_targetMaskId_fkey"
  FOREIGN KEY ("targetMaskId") REFERENCES "Mask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomModeration"
  ADD CONSTRAINT "RoomModeration_actorMaskId_fkey"
  FOREIGN KEY ("actorMaskId") REFERENCES "Mask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
