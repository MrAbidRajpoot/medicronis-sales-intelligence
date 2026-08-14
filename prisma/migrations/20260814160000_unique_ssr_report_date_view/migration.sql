-- Keep the newest generated report when historical duplicates exist.
DELETE FROM "SsrReport"
WHERE "id" IN (
    SELECT "id"
    FROM (
        SELECT
            "id",
            ROW_NUMBER() OVER (
                PARTITION BY "asOfDate", "viewType"
                ORDER BY "generatedAt" DESC NULLS LAST, "updatedAt" DESC, "createdAt" DESC, "id" DESC
            ) AS "duplicateRank"
        FROM "SsrReport"
        WHERE "asOfDate" IS NOT NULL
          AND "viewType" IS NOT NULL
    ) AS "rankedReports"
    WHERE "duplicateRank" > 1
);

DROP INDEX IF EXISTS "SsrReport_asOfDate_viewType_idx";

CREATE UNIQUE INDEX "SsrReport_asOfDate_viewType_key"
ON "SsrReport"("asOfDate", "viewType");
