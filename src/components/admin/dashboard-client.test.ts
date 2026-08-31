import { describe, expect, it, vi } from "vitest";

import { fetchAdminDashboard, isAdminDashboardPayload } from "./dashboard-client";

const validDashboard = {
  draft: { id: "draft-id", updatedAt: "2026-08-31T00:00:00+00:00" },
  published: { id: "published-id", publishedAt: "2026-08-30T00:00:00+00:00" },
  counts: { questions: 10, answers: 75 },
  unpublishedChanges: false,
};

describe("admin dashboard client", () => {
  it("accepts valid DRAFT and PUBLISHED dashboard data", async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => validDashboard });
    await expect(fetchAdminDashboard(request)).resolves.toEqual(validDashboard);
  });

  it("accepts a valid dashboard without a PUBLISHED version", async () => {
    const payload = { ...validDashboard, published: null };
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    await expect(fetchAdminDashboard(request)).resolves.toEqual(payload);
    expect(isAdminDashboardPayload(payload)).toBe(true);
  });

  it("rejects a 503 error payload instead of treating it as dashboard data", async () => {
    const payload = { error: "ADMIN_READ_UNAVAILABLE" };
    const request = vi.fn().mockResolvedValue({ ok: false, json: async () => payload });
    await expect(fetchAdminDashboard(request)).rejects.toThrow("ADMIN_DASHBOARD_UNAVAILABLE");
    expect(isAdminDashboardPayload(payload)).toBe(false);
  });

  it("starts a new fetch when the user retries after a failure", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "ADMIN_READ_UNAVAILABLE" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => validDashboard });
    await expect(fetchAdminDashboard(request)).rejects.toThrow("ADMIN_DASHBOARD_UNAVAILABLE");
    await expect(fetchAdminDashboard(request)).resolves.toEqual(validDashboard);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
