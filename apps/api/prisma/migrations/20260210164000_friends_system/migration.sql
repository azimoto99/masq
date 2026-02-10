-- CreateEnum
CREATE TYPE "FriendRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELED');

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "defaultMaskId" UUID;

-- CreateTable
CREATE TABLE "FriendRequest" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "fromUserId" UUID NOT NULL,
  "toUserId" UUID NOT NULL,
  "status" "FriendRequestStatus" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FriendRequest_fromUserId_toUserId_check" CHECK ("fromUserId" <> "toUserId"),
  CONSTRAINT "FriendRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Friendship" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userAId" UUID NOT NULL,
  "userBId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Friendship_userAId_userBId_check" CHECK ("userAId" <> "userBId"),
  CONSTRAINT "Friendship_userAId_userBId_order_check" CHECK ("userAId" < "userBId"),
  CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FriendRequest_fromUserId_toUserId_key"
  ON "FriendRequest"("fromUserId", "toUserId");

-- CreateIndex
CREATE INDEX "FriendRequest_toUserId_status_updatedAt_idx"
  ON "FriendRequest"("toUserId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "FriendRequest_fromUserId_status_updatedAt_idx"
  ON "FriendRequest"("fromUserId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_userAId_userBId_key"
  ON "Friendship"("userAId", "userBId");

-- CreateIndex
CREATE INDEX "Friendship_userAId_idx"
  ON "Friendship"("userAId");

-- CreateIndex
CREATE INDEX "Friendship_userBId_idx"
  ON "Friendship"("userBId");

-- AddForeignKey
ALTER TABLE "User"
  ADD CONSTRAINT "User_defaultMaskId_fkey"
  FOREIGN KEY ("defaultMaskId") REFERENCES "Mask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendRequest"
  ADD CONSTRAINT "FriendRequest_fromUserId_fkey"
  FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendRequest"
  ADD CONSTRAINT "FriendRequest_toUserId_fkey"
  FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship"
  ADD CONSTRAINT "Friendship_userAId_fkey"
  FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship"
  ADD CONSTRAINT "Friendship_userBId_fkey"
  FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

