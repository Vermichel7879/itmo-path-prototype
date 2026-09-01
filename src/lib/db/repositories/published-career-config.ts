import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { getDatabase } from "../client";
import { readPublishedSnapshotChunks } from "../config/snapshot-reader";
import { validatePublishableCareerSnapshot } from "../publish/publish-validation";
import { configVersions } from "../schema";

export interface PublishedCareerConfigRecord {
  id: string;
  versionNumber: number;
  publishedAt: Date;
  snapshot: ReturnType<typeof validatePublishableCareerSnapshot>;
}

const globalPublishedCache = globalThis as typeof globalThis & {
  publishedCareerConfigCache?: Map<string, PublishedCareerConfigRecord>;
};
const publishedCache = globalPublishedCache.publishedCareerConfigCache ?? new Map<string, PublishedCareerConfigRecord>();
globalPublishedCache.publishedCareerConfigCache = publishedCache;

async function parsePublishedVersion(
  version: {
    id: string;
    versionNumber: number;
    publishedAt: Date | null;
    sourceSha256: string | null;
    snapshotSourceSha256: string | null;
    snapshotValid: boolean;
    rulesComplete: boolean;
  } | undefined,
): Promise<PublishedCareerConfigRecord | null> {
  if (!version) return null;
  if (!version.publishedAt) {
    throw new Error("PUBLISHED_CONFIG_INVALID reason=MISSING_PUBLISHED_AT");
  }
  if (!version.snapshotValid || !version.rulesComplete || !version.sourceSha256 || version.snapshotSourceSha256 !== version.sourceSha256) {
    throw new Error("PUBLISHED_CONFIG_INVALID reason=SNAPSHOT_METADATA");
  }
  const rawSnapshot = await readPublishedSnapshotChunks(getDatabase(), version.id);
  const snapshot = validatePublishableCareerSnapshot(rawSnapshot);
  if (snapshot.source.sha256 !== version.sourceSha256) throw new Error("PUBLISHED_CONFIG_INVALID reason=SOURCE_HASH");
  return {
    ...version,
    publishedAt: version.publishedAt,
    snapshot,
  };
}

const publishedSelection = {
  id: configVersions.id,
  versionNumber: configVersions.versionNumber,
  publishedAt: configVersions.publishedAt,
  sourceSha256: configVersions.sourceSha256,
  snapshotSourceSha256: sql<string | null>`${configVersions.snapshot} -> 'source' ->> 'sha256'`,
  snapshotValid: sql<boolean>`
    jsonb_typeof(${configVersions.snapshot}) = 'object'
    and jsonb_typeof(${configVersions.snapshot} -> 'questions') = 'array'
    and jsonb_array_length(${configVersions.snapshot} -> 'questions') > 0
    and jsonb_typeof(${configVersions.snapshot} -> 'answers') = 'array'
    and jsonb_array_length(${configVersions.snapshot} -> 'answers') > 0
    and jsonb_typeof(${configVersions.snapshot} -> 'modules') = 'array'
    and jsonb_array_length(${configVersions.snapshot} -> 'modules') > 0
    and jsonb_array_length(${configVersions.snapshot} -> 'engineRules') >= 17
    and jsonb_array_length(${configVersions.snapshot} -> 'documentationExamples') = 7
  `,
  rulesComplete: sql<boolean>`
    (select count(distinct item ->> 'stableId')
     from jsonb_array_elements(${configVersions.snapshot} -> 'engineRules') item
     where item ->> 'stableId' = any(array[
       'R01','R02','R03','R04','R05','R06','R07','R08','R09',
       'R10','R11','R12','R13','R14','R15','R16','R17'
     ])) = 17
  `,
};

export async function getLatestPublishedCareerConfig() {
  const [version] = await getDatabase()
    .select(publishedSelection)
    .from(configVersions)
    .where(eq(configVersions.status, "PUBLISHED"))
    .orderBy(desc(configVersions.publishedAt), desc(configVersions.versionNumber))
    .limit(1);
  const parsed = await parsePublishedVersion(version);
  if (parsed) publishedCache.set(parsed.id, parsed);
  return parsed;
}

export async function getPublishedCareerConfigById(id: string) {
  const cached = publishedCache.get(id);
  if (cached) return cached;
  const [version] = await getDatabase()
    .select(publishedSelection)
    .from(configVersions)
    .where(
      and(eq(configVersions.id, id), eq(configVersions.status, "PUBLISHED")),
    )
    .limit(1);
  const parsed = await parsePublishedVersion(version);
  if (parsed) publishedCache.set(parsed.id, parsed);
  return parsed;
}
