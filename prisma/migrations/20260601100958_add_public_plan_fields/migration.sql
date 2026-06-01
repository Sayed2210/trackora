-- AlterTable
ALTER TABLE "Plan" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Plan" ADD COLUMN "isPopular" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Plan" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Plan" ADD COLUMN "yearlyPrice" DECIMAL(10, 2);

-- DropIndex
DROP INDEX IF EXISTS "Plan_isActive_archivedAt_idx";

-- CreateIndex
CREATE INDEX "Plan_isActive_isPublic_archivedAt_idx" ON "Plan"("isActive", "isPublic", "archivedAt");
CREATE INDEX "Plan_sortOrder_idx" ON "Plan"("sortOrder");