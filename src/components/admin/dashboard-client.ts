export type AdminDashboardPayload = {
  draft: {
    id: string;
    updatedAt: string;
  };
  published: {
    id: string;
    publishedAt: string | null;
  } | null;
  counts: Record<string, number>;
  unpublishedChanges: boolean;
};

type DashboardFetch = (input: string) => Promise<{
  ok: boolean;
  json(): Promise<unknown>;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isAdminDashboardPayload(value: unknown): value is AdminDashboardPayload {
  if (!isRecord(value) || !isRecord(value.draft) || !isRecord(value.counts)) return false;
  const publishedValid = value.published === null || (
    isRecord(value.published) &&
    typeof value.published.id === "string" &&
    (value.published.publishedAt === null || typeof value.published.publishedAt === "string")
  );
  return typeof value.draft.id === "string" &&
    typeof value.draft.updatedAt === "string" &&
    typeof value.unpublishedChanges === "boolean" &&
    Object.values(value.counts).every((count) => typeof count === "number") &&
    publishedValid;
}

export async function fetchAdminDashboard(
  fetchDashboard: DashboardFetch = fetch,
): Promise<AdminDashboardPayload> {
  const response = await fetchDashboard("/api/admin/dashboard");
  const payload = await response.json();
  if (!response.ok || !isAdminDashboardPayload(payload)) {
    throw new Error("ADMIN_DASHBOARD_UNAVAILABLE");
  }
  return payload;
}
