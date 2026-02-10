-- RenameEnum
ALTER TYPE "ServerMemberRole" RENAME TO "ServerMembershipRole";

-- CreateTable
CREATE TABLE "ServerRole" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "serverId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "permissions" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServerRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerMemberRole" (
  "serverId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "roleId" UUID NOT NULL,
  CONSTRAINT "ServerMemberRole_pkey" PRIMARY KEY ("serverId", "userId", "roleId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServerRole_serverId_name_key"
  ON "ServerRole"("serverId", "name");

-- CreateIndex
CREATE INDEX "ServerRole_serverId_createdAt_idx"
  ON "ServerRole"("serverId", "createdAt");

-- CreateIndex
CREATE INDEX "ServerMemberRole_serverId_userId_idx"
  ON "ServerMemberRole"("serverId", "userId");

-- CreateIndex
CREATE INDEX "ServerMemberRole_roleId_idx"
  ON "ServerMemberRole"("roleId");

-- AddForeignKey
ALTER TABLE "ServerRole"
  ADD CONSTRAINT "ServerRole_serverId_fkey"
  FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerMemberRole"
  ADD CONSTRAINT "ServerMemberRole_serverId_userId_fkey"
  FOREIGN KEY ("serverId", "userId") REFERENCES "ServerMember"("serverId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerMemberRole"
  ADD CONSTRAINT "ServerMemberRole_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerMemberRole"
  ADD CONSTRAINT "ServerMemberRole_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "ServerRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default server roles for existing servers.
INSERT INTO "ServerRole" ("serverId", "name", "permissions")
SELECT "id", 'ADMIN', '["ManageChannels","ManageMembers","CreateInvites","ModerateChat"]'::jsonb
FROM "Server"
ON CONFLICT ("serverId", "name") DO NOTHING;

INSERT INTO "ServerRole" ("serverId", "name", "permissions")
SELECT "id", 'MEMBER', '[]'::jsonb
FROM "Server"
ON CONFLICT ("serverId", "name") DO NOTHING;

-- Backfill role assignments for existing non-owner members.
INSERT INTO "ServerMemberRole" ("serverId", "userId", "roleId")
SELECT
  member."serverId",
  member."userId",
  role."id"
FROM "ServerMember" AS member
JOIN "ServerRole" AS role
  ON role."serverId" = member."serverId"
 AND role."name" = CASE WHEN member."role" = 'ADMIN' THEN 'ADMIN' ELSE 'MEMBER' END
WHERE member."role" <> 'OWNER'
ON CONFLICT ("serverId", "userId", "roleId") DO NOTHING;