-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "friendCode" TEXT;

-- Backfill existing users with deterministic unique friend codes.
WITH ranked_users AS (
  SELECT
    "id",
    CONCAT(
      'USR',
      LPAD(UPPER(TO_HEX(ROW_NUMBER() OVER (ORDER BY "createdAt", "id"))), 7, '0')
    ) AS generated_code
  FROM "User"
)
UPDATE "User" AS u
SET "friendCode" = ranked_users.generated_code
FROM ranked_users
WHERE ranked_users."id" = u."id";

-- AlterTable
ALTER TABLE "User"
  ALTER COLUMN "friendCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_friendCode_key" ON "User"("friendCode");
