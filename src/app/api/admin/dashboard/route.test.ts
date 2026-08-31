import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  adminApiError,
  getCurrentDraftConfig,
  getLatestPublishedSummary,
  getPublishPreparation,
} = vi.hoisted(() => ({
  adminApiError: vi.fn((error: Error, options?: { readOnly?: boolean }) =>
    Response.json(
      { error: options?.readOnly ? "ADMIN_READ_UNAVAILABLE" : error.message },
      { status: options?.readOnly ? 503 : 422 },
    )),
  getCurrentDraftConfig: vi.fn(),
  getLatestPublishedSummary: vi.fn(),
  getPublishPreparation: vi.fn(),
}));

vi.mock("@/lib/admin/api", () => ({
  requireAdminApiSession: vi.fn(async () => ({ userId: "actor-id", role: "ADMIN" })),
  adminApiError,
}));
vi.mock("@/lib/admin/draft-service", () => ({ getCurrentDraftConfig }));
vi.mock("@/lib/admin/publish-service", () => ({ getPublishPreparation }));
vi.mock("@/lib/admin/data-api", () => ({
  adminDataApi: { getLatestPublishedSummary },
}));

import { GET } from "./route";

const snapshot = {
  questions: [],
  answers: [],
  mappings: [],
  modules: [],
  recommendations: [],
  opportunities: [],
  engineRules: [],
  modifiers: [],
};

describe("admin dashboard read route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentDraftConfig.mockResolvedValue({
      id: "draft-id",
      updatedAt: "2026-08-31T00:00:00+00:00",
      validation: { valid: true, issues: [] },
      snapshot,
    });
    getPublishPreparation.mockResolvedValue({
      diff: { questions: { added: 0, changed: 0, removed: 0 } },
    });
    getLatestPublishedSummary.mockResolvedValue({
      id: "published-id",
      publishedAt: "2026-08-30T00:00:00+00:00",
    });
  });

  it("returns 200 with valid DRAFT and PUBLISHED data", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      draft: { id: "draft-id" },
      published: { id: "published-id" },
    });
  });

  it("returns 200 when no PUBLISHED version exists", async () => {
    getLatestPublishedSummary.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      draft: { id: "draft-id" },
      published: null,
    });
  });

  it("uses read-only error mapping after an exhausted transport failure", async () => {
    const error = new Error("transport exhausted");
    getCurrentDraftConfig.mockRejectedValue(error);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(adminApiError).toHaveBeenCalledWith(error, { readOnly: true });
  });
});
