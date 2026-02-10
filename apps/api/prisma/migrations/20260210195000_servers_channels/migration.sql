-- CreateEnum
CREATE TYPE "ServerMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('TEXT');

-- CreateTable
CREATE TABLE "Server" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "ownerUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Server_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerInvite" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "serverId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "maxUses" INTEGER,
  "uses" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ServerInvite_maxUses_check" CHECK ("maxUses" IS NULL OR "maxUses" > 0),
  CONSTRAINT "ServerInvite_uses_check" CHECK ("uses" >= 0),
  CONSTRAINT "ServerInvite_uses_vs_maxUses_check" CHECK ("maxUses" IS NULL OR "uses" <= "maxUses"),
  CONSTRAINT "ServerInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerMember" (
  "serverId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" "ServerMemberRole" NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "serverMaskId" UUID NOT NULL,
  CONSTRAINT "ServerMember_pkey" PRIMARY KEY ("serverId", "userId")
);

-- CreateTable
CREATE TABLE "Channel" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "serverId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "type" "ChannelType" NOT NULL DEFAULT 'TEXT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerMessage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "channelId" UUID NOT NULL,
  "maskId" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServerMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Server_ownerUserId_createdAt_idx"
  ON "Server"("ownerUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServerInvite_code_key"
  ON "ServerInvite"("code");

-- CreateIndex
CREATE INDEX "ServerInvite_serverId_createdAt_idx"
  ON "ServerInvite"("serverId", "createdAt");

-- CreateIndex
CREATE INDEX "ServerMember_userId_joinedAt_idx"
  ON "ServerMember"("userId", "joinedAt");

-- CreateIndex
CREATE INDEX "ServerMember_serverId_role_idx"
  ON "ServerMember"("serverId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_serverId_name_key"
  ON "Channel"("serverId", "name");

-- CreateIndex
CREATE INDEX "Channel_serverId_createdAt_idx"
  ON "Channel"("serverId", "createdAt");

-- CreateIndex
CREATE INDEX "ServerMessage_channelId_createdAt_idx"
  ON "ServerMessage"("channelId", "createdAt");

-- AddForeignKey
ALTER TABLE "Server"
  ADD CONSTRAINT "Server_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerInvite"
  ADD CONSTRAINT "ServerInvite_serverId_fkey"
  FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerMember"
  ADD CONSTRAINT "ServerMember_serverId_fkey"
  FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerMember"
  ADD CONSTRAINT "ServerMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerMember"
  ADD CONSTRAINT "ServerMember_serverMaskId_fkey"
  FOREIGN KEY ("serverMaskId") REFERENCES "Mask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel"
  ADD CONSTRAINT "Channel_serverId_fkey"
  FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerMessage"
  ADD CONSTRAINT "ServerMessage_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerMessage"
  ADD CONSTRAINT "ServerMessage_maskId_fkey"
  FOREIGN KEY ("maskId") REFERENCES "Mask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
