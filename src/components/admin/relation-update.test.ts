import { describe, expect, it, vi } from "vitest";

import { patchRelationUpdate } from "./relation-update";

describe("relation UPDATE requests", () => {
  it("sends the edited mapping weight", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await patchRelationUpdate({
      entityType: "MAPPING_UPDATE",
      stableId: "Q2_A3:M01",
      expectedUpdatedAt: "2026-08-27T10:00:00.000Z",
      valueName: "weight",
      value: 4,
    }, request);

    expect(request).toHaveBeenCalledOnce();
    expect(JSON.parse(request.mock.calls[0][1].body as string)).toEqual({
      entityType: "MAPPING_UPDATE",
      stableId: "Q2_A3:M01",
      expectedUpdatedAt: "2026-08-27T10:00:00.000Z",
      values: { weight: 4 },
    });
  });

  it("sends the edited module recommendation priority", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await patchRelationUpdate({
      entityType: "MODULE_RECOMMENDATION_UPDATE",
      stableId: "M01:REC01",
      expectedUpdatedAt: "2026-08-27T10:01:00.000Z",
      valueName: "priority",
      value: 5,
    }, request);

    expect(request).toHaveBeenCalledOnce();
    expect(JSON.parse(request.mock.calls[0][1].body as string)).toEqual({
      entityType: "MODULE_RECOMMENDATION_UPDATE",
      stableId: "M01:REC01",
      expectedUpdatedAt: "2026-08-27T10:01:00.000Z",
      values: { priority: 5 },
    });
  });
});
