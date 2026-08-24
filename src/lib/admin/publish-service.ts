import "server-only";

import { max, sql } from "drizzle-orm";

import { requireCapability } from "@/lib/auth/permissions";
import { getDatabase } from "@/lib/db/client";
import { auditLog, configVersions } from "@/lib/db/schema";
import { getLatestPublishedCareerConfig } from "@/lib/db/repositories/published-career-config";

import { getCurrentDraftConfig, DraftConflictError } from "./draft-service";
import { validateDraftCareerConfig } from "./validation";

type Snapshot = Awaited<ReturnType<typeof getCurrentDraftConfig>>["snapshot"];

const diffKeys = [
  "questions",
  "answers",
  "modules",
  "recommendations",
  "opportunities",
  "engineRules",
  "modifiers",
] as const;

export function summarizeSnapshotDiff(previous: Snapshot, next: Snapshot) {
  return Object.fromEntries(
    diffKeys.map((key) => {
      const before = new Map(previous[key].map((item) => [item.stableId, item]));
      const after = new Map(next[key].map((item) => [item.stableId, item]));
      const added = [...after.keys()].filter((id) => !before.has(id)).length;
      const removed = [...before.keys()].filter((id) => !after.has(id)).length;
      const changed = [...after].filter(
        ([id, value]) => before.has(id) && JSON.stringify(before.get(id)) !== JSON.stringify(value),
      ).length;
      return [key, { added, changed, removed }];
    }),
  );
}

export async function getPublishPreparation() {
  const draft = await getCurrentDraftConfig();
  const latest = await getLatestPublishedCareerConfig();
  const previous = latest?.snapshot ?? draft.snapshot;
  return {
    draftId: draft.id,
    expectedUpdatedAt: draft.updatedAt,
    validation: validateDraftCareerConfig(draft.snapshot),
    diff: summarizeSnapshotDiff(previous, draft.snapshot),
  };
}

export async function publishCurrentDraft(input: {
  actorUserId: string;
  actorRole: "ADMIN" | "EDITOR";
  expectedUpdatedAt: string;
  label?: string;
}) {
  requireCapability(input.actorRole, "PUBLISH");
  const prepared = await getCurrentDraftConfig();
  if (prepared.updatedAt !== input.expectedUpdatedAt) throw new DraftConflictError();
  const validation = validateDraftCareerConfig(prepared.snapshot);
  if (!validation.valid) throw new Error("PUBLISH_BLOCKED_BY_VALIDATION");

  return getDatabase().transaction(async (tx) => {
    const locked = await tx.execute<Record<string, unknown>>(sql`
      select id, updated_at as "updatedAt"
      from config_versions
      where status = 'DRAFT'
      for update
    `);
    const row = locked[0];
    if (!row || new Date(String(row.updatedAt)).toISOString() !== input.expectedUpdatedAt) {
      throw new DraftConflictError();
    }
    const [version] = await tx.select({ value: max(configVersions.versionNumber) }).from(configVersions);
    const now = new Date();
    const [published] = await tx
      .insert(configVersions)
      .values({
        versionNumber: (version?.value ?? 0) + 1,
        status: "PUBLISHED",
        label: input.label?.trim() || `Published ${now.toISOString()}`,
        sourceFileName: prepared.snapshot.source.fileName,
        sourceSha256: prepared.snapshot.source.sha256,
        snapshot: prepared.snapshot,
        createdByAdminUserId: input.actorUserId,
        publishedByAdminUserId: input.actorUserId,
        publishedAt: now,
      })
      .returning({ id: configVersions.id, versionNumber: configVersions.versionNumber });
    await tx.insert(auditLog).values({
      actorAdminUserId: input.actorUserId,
      configVersionId: published.id,
      action: "CONFIG_PUBLISHED",
      entityType: "CONFIG_VERSION",
      entityId: published.id,
      metadata: { versionNumber: published.versionNumber, draftId: prepared.id },
    });
    return { ...published, publishedAt: now.toISOString() };
  });
}
