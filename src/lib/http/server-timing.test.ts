import { describe, expect, it, vi } from "vitest";

import {
  formatServerTiming,
  measureServerTiming,
  withServerTiming,
} from "./server-timing";

describe("public API Server-Timing", () => {
  it("formats only safe metric names and finite non-negative durations", () => {
    expect(formatServerTiming({
      data_api: 12.345,
      rule_engine: -2,
      "unsafe metric": 4,
      invalid: Number.NaN,
    })).toBe("data_api;dur=12.3, rule_engine;dur=0");
  });

  it("records one operation under multiple aggregate metrics", async () => {
    const now = vi.spyOn(Date, "now")
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(125);
    const metrics = { data_api: 5 };
    await expect(measureServerTiming(
      metrics,
      ["session_read", "data_api"],
      async () => "ok",
    )).resolves.toBe("ok");
    expect(metrics).toEqual({ data_api: 30, session_read: 25 });
    now.mockRestore();
  });

  it("attaches total and internal timings without exposing request data", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(250);
    const response = withServerTiming(
      Response.json({ ok: true }),
      200,
      { config_read: 20, data_api: 21 },
    );
    expect(response.headers.get("Server-Timing")).toBe(
      "total;dur=50, config_read;dur=20, data_api;dur=21",
    );
    now.mockRestore();
  });
});
