import "server-only";

import { eq } from "drizzle-orm";

import { configVersions } from "../schema";
import { getDatabase } from "../client";
export { getLatestPublishedCareerConfig as getLatestPublishedConfig } from "../repositories/published-career-config";

export async function getDraftConfigVersion() {
  const [draft] = await getDatabase()
    .select()
    .from(configVersions)
    .where(eq(configVersions.status, "DRAFT"))
    .limit(1);
  return draft ?? null;
}
