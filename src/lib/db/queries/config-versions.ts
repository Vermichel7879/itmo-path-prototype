import "server-only";

import { desc, eq } from "drizzle-orm";

import { careerImportSchema } from "../import/import-model";
import { configVersions } from "../schema";
import { getDatabase } from "../client";

export async function getLatestPublishedConfig() {
  const [version] = await getDatabase()
    .select({
      id: configVersions.id,
      versionNumber: configVersions.versionNumber,
      publishedAt: configVersions.publishedAt,
      snapshot: configVersions.snapshot,
    })
    .from(configVersions)
    .where(eq(configVersions.status, "PUBLISHED"))
    .orderBy(desc(configVersions.publishedAt), desc(configVersions.versionNumber))
    .limit(1);

  if (!version) return null;
  return { ...version, snapshot: careerImportSchema.parse(version.snapshot) };
}

export async function getDraftConfigVersion() {
  const [draft] = await getDatabase()
    .select()
    .from(configVersions)
    .where(eq(configVersions.status, "DRAFT"))
    .limit(1);
  return draft ?? null;
}
