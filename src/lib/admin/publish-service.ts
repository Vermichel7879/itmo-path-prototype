import "server-only";

import { requireCapability } from "@/lib/auth/permissions";
import { validateCareerImport } from "@/lib/db/import/import-model";
import { AdminDataApiError } from "@/lib/supabase/admin-rpc";

import { adminDataApi } from "./data-api";
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
  const latest = await adminDataApi.getLatestPublishedSnapshot();
  const previous = latest
    ? validateCareerImport(latest.snapshot)
    : draft.snapshot;
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

  try {
    return await adminDataApi.publishDraft({
      actorUserId: input.actorUserId,
      expectedUpdatedAt: input.expectedUpdatedAt,
      expectedSnapshotHash: prepared.snapshotHash,
      label:
        input.label?.trim() || `Published ${new Date().toISOString()}`,
    });
  } catch (error) {
    if (
      error instanceof AdminDataApiError &&
      error.message === "DRAFT_STALE_REVISION"
    ) {
      throw new DraftConflictError();
    }
    throw error;
  }
}
