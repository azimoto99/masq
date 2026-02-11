-- CreateEnum
CREATE TYPE "UploadKind" AS ENUM ('MESSAGE_IMAGE', 'MASK_AVATAR');

-- CreateEnum
CREATE TYPE "UploadContextType" AS ENUM ('SERVER_CHANNEL', 'DM_THREAD', 'EPHEMERAL_ROOM');

-- AlterTable
ALTER TABLE "Mask" ADD COLUMN "avatarUploadId" UUID;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "imageUploadId" UUID;

-- AlterTable
ALTER TABLE "ServerMessage" ADD COLUMN "imageUploadId" UUID;

-- AlterTable
ALTER TABLE "DMMessage" ADD COLUMN "imageUploadId" UUID;

-- CreateTable
CREATE TABLE "Upload" (
  "id" UUID NOT NULL,
  "ownerUserId" UUID NOT NULL,
  "kind" "UploadKind" NOT NULL,
  "contextType" "UploadContextType",
  "contextId" UUID,
  "fileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "storagePath" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Upload_ownerUserId_createdAt_idx" ON "Upload"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Upload_contextType_contextId_createdAt_idx" ON "Upload"("contextType", "contextId", "createdAt");

-- AddForeignKey
ALTER TABLE "Upload"
  ADD CONSTRAINT "Upload_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mask"
  ADD CONSTRAINT "Mask_avatarUploadId_fkey"
  FOREIGN KEY ("avatarUploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message"
  ADD CONSTRAINT "Message_imageUploadId_fkey"
  FOREIGN KEY ("imageUploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerMessage"
  ADD CONSTRAINT "ServerMessage_imageUploadId_fkey"
  FOREIGN KEY ("imageUploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DMMessage"
  ADD CONSTRAINT "DMMessage_imageUploadId_fkey"
  FOREIGN KEY ("imageUploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;
