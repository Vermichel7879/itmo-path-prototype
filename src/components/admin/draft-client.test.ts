import { describe, expect, it, vi } from "vitest";

import { fetchAdminDraft, isAdminDraftPayload } from "./draft-client";

const validDraft = {
  id: "draft-id",
  updatedAt: "2026-08-31T00:00:00+00:00",
  snapshot: { questions: [] },
  validation: { valid: true, issues: [] },
};

describe("admin draft client", () => {
  it("accepts a valid draft response", async () => {
    const fetchDraft = vi.fn().mockResolvedValue({ ok: true, json: async () => validDraft });
    await expect(fetchAdminDraft(fetchDraft)).resolves.toEqual(validDraft);
    expect(isAdminDraftPayload(validDraft)).toBe(true);
  });

  it("rejects an API error payload instead of treating it as a draft", async () => {
    const fetchDraft = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "ADMIN_DATA_API_ERROR" }),
    });
    await expect(fetchAdminDraft(fetchDraft)).rejects.toThrow("ADMIN_DRAFT_UNAVAILABLE");
    expect(isAdminDraftPayload({ error: "ADMIN_DATA_API_ERROR" })).toBe(false);
  });

  it("deduplicates concurrent draft reads", async () => {
    let resolveResponse: ((value: { ok: boolean; json(): Promise<unknown> }) => void) | undefined;
    const fetchDraft = vi.fn(() => new Promise<{ ok: boolean; json(): Promise<unknown> }>((resolve) => {
      resolveResponse = resolve;
    }));
    const first = fetchAdminDraft(fetchDraft);
    const second = fetchAdminDraft(fetchDraft);
    resolveResponse?.({ ok: true, json: async () => validDraft });
    await expect(Promise.all([first, second])).resolves.toEqual([validDraft, validDraft]);
    expect(fetchDraft).toHaveBeenCalledTimes(1);
  });

  it("starts a new request when the user retries after a failed read", async () => {
    const fetchDraft = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "ADMIN_READ_UNAVAILABLE" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => validDraft });
    await expect(fetchAdminDraft(fetchDraft)).rejects.toThrow("ADMIN_DRAFT_UNAVAILABLE");
    await expect(fetchAdminDraft(fetchDraft)).resolves.toEqual(validDraft);
    expect(fetchDraft).toHaveBeenCalledTimes(2);
  });
});
