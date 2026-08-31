import { beforeEach, describe, expect, it, vi } from "vitest";

const firstRevision = "2026-08-27T18:07:55.064871+00:00";
const secondRevision = "2026-08-27T18:08:01.123456+00:00";
const thirdRevision = "2026-08-27T18:08:02.654321+00:00";

const { adminApiError, getCurrentDraftConfig, mutateCurrentDraft } = vi.hoisted(() => ({
  adminApiError: vi.fn((error: Error, options?: { readOnly?: boolean }) =>
    Response.json(
      { error: options?.readOnly ? "ADMIN_READ_UNAVAILABLE" : error.message },
      { status: options?.readOnly ? 503 : 422 },
    )),
  getCurrentDraftConfig: vi.fn(),
  mutateCurrentDraft: vi.fn(),
}));

vi.mock("@/lib/auth/request", () => ({ assertTrustedOrigin: vi.fn() }));
vi.mock("@/lib/admin/api", () => ({
  requireAdminApiSession: vi.fn(async () => ({ userId: "actor-id", role: "ADMIN" })),
  adminApiError,
}));
vi.mock("@/lib/admin/draft-service", () => ({
  draftMutationSchema: { safeParse: (data: unknown) => ({ success: true, data }) },
  getCurrentDraftConfig,
  mutateCurrentDraft,
}));

import { GET, PATCH } from "./route";

describe("admin DRAFT route revision flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentDraftConfig.mockResolvedValue({ updatedAt: firstRevision });
    mutateCurrentDraft
      .mockResolvedValueOnce({ id: "draft-id", updatedAt: secondRevision })
      .mockResolvedValueOnce({ id: "draft-id", updatedAt: thirdRevision });
  });

  it("returns 200 for a fresh QUESTION save and the next save with its returned revision", async () => {
    const loaded = await GET();
    const loadedDraft = await loaded.json() as { updatedAt: string };

    const first = await PATCH(new Request("http://localhost/api/admin/draft", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entityType: "QUESTION",
        stableId: "Q2",
        expectedUpdatedAt: loadedDraft.updatedAt,
        values: { text: "Первое сохранение" },
      }),
    }));
    expect(first.status).toBe(200);
    const firstResult = await first.json() as { updatedAt: string };

    const second = await PATCH(new Request("http://localhost/api/admin/draft", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entityType: "QUESTION",
        stableId: "Q2",
        expectedUpdatedAt: firstResult.updatedAt,
        values: { text: "Второе сохранение" },
      }),
    }));
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ updatedAt: thirdRevision });
  });

  it("uses read-only error mapping when DRAFT loading fails", async () => {
    const error = new Error("transport exhausted");
    getCurrentDraftConfig.mockRejectedValue(error);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(adminApiError).toHaveBeenCalledWith(error, { readOnly: true });
  });
});
