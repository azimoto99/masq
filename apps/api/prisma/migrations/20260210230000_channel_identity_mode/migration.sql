-- CreateEnum
CREATE TYPE "ChannelIdentityMode" AS ENUM ('SERVER_MASK', 'CHANNEL_MASK');

-- AlterTable
ALTER TABLE "Server"
  ADD COLUMN "channelIdentityMode" "ChannelIdentityMode" NOT NULL DEFAULT 'SERVER_MASK';

-- CreateTable
CREATE TABLE "ChannelMemberIdentity" (
  "channelId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "maskId" UUID NOT NULL,
  CONSTRAINT "ChannelMemberIdentity_pkey" PRIMARY KEY ("channelId", "userId")
);

-- CreateIndex
CREATE INDEX "ChannelMemberIdentity_userId_channelId_idx"
  ON "ChannelMemberIdentity"("userId", "channelId");

-- AddForeignKey
ALTER TABLE "ChannelMemberIdentity"
  ADD CONSTRAINT "ChannelMemberIdentity_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMemberIdentity"
  ADD CONSTRAINT "ChannelMemberIdentity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMemberIdentity"
  ADD CONSTRAINT "ChannelMemberIdentity_maskId_fkey"
  FOREIGN KEY ("maskId") REFERENCES "Mask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;