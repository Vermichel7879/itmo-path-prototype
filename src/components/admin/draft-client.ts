export type AdminDraftPayload = {
  id: string;
  updatedAt: string;
  snapshot: Record<string, unknown>;
  validation: {
    valid: boolean;
    issues: Record<string, unknown>[];
  };
};

type DraftFetch = (input: string) => Promise<{
  ok: boolean;
  json(): Promise<unknown>;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isAdminDraftPayload(value: unknown): value is AdminDraftPayload {
  if (!isRecord(value) || !isRecord(value.snapshot) || !isRecord(value.validation)) return false;
  return typeof value.id === "string" &&
    typeof value.updatedAt === "string" &&
    typeof value.validation.valid === "boolean" &&
    Array.isArray(value.validation.issues);
}

let activeDraftRequest: Promise<AdminDraftPayload> | null = null;

export function fetchAdminDraft(fetchDraft: DraftFetch = fetch): Promise<AdminDraftPayload> {
  if (activeDraftRequest) return activeDraftRequest;
  activeDraftRequest = (async () => {
    const response = await fetchDraft("/api/admin/draft");
    const payload = await response.json();
    if (!response.ok || !isAdminDraftPayload(payload)) {
      throw new Error("ADMIN_DRAFT_UNAVAILABLE");
    }
    return payload;
  })().finally(() => {
    activeDraftRequest = null;
  });
  return activeDraftRequest;
}
