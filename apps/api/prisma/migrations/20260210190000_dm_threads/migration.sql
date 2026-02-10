-- CreateTable
CREATE TABLE "DMThread" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userAId" UUID NOT NULL,
  "userBId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DMThread_userAId_userBId_check" CHECK ("userAId" <> "userBId"),
  CONSTRAINT "DMThread_userAId_userBId_order_check" CHECK ("userAId" < "userBId"),
  CONSTRAINT "DMThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DMParticipant" (
  "threadId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "activeMaskId" UUID NOT NULL,
  CONSTRAINT "DMParticipant_pkey" PRIMARY KEY ("threadId", "userId")
);

-- CreateTable
CREATE TABLE "DMMessage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "threadId" UUID NOT NULL,
  "maskId" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DMMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DMThread_userAId_userBId_key"
  ON "DMThread"("userAId", "userBId");

-- CreateIndex
CREATE INDEX "DMThread_userAId_idx"
  ON "DMThread"("userAId");

-- CreateIndex
CREATE INDEX "DMThread_userBId_idx"
  ON "DMThread"("userBId");

-- CreateIndex
CREATE INDEX "DMParticipant_userId_threadId_idx"
  ON "DMParticipant"("userId", "threadId");

-- CreateIndex
CREATE INDEX "DMMessage_threadId_createdAt_idx"
  ON "DMMessage"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "DMThread"
  ADD CONSTRAINT "DMThread_userAId_fkey"
  FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DMThread"
  ADD CONSTRAINT "DMThread_userBId_fkey"
  FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DMParticipant"
  ADD CONSTRAINT "DMParticipant_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "DMThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DMParticipant"
  ADD CONSTRAINT "DMParticipant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DMParticipant"
  ADD CONSTRAINT "DMParticipant_activeMaskId_fkey"
  FOREIGN KEY ("activeMaskId") REFERENCES "Mask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DMMessage"
  ADD CONSTRAINT "DMMessage_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "DMThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DMMessage"
  ADD CONSTRAINT "DMMessage_maskId_fkey"
  FOREIGN KEY ("maskId") REFERENCES "Mask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
