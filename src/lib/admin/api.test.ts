import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AdminDataApiError } from "@/lib/supabase/admin-rpc";

import { adminApiError } from "./api";

describe("admin API error mapping", () => {
  it("maps an exhausted read-only transport failure to 503", async () => {
    const response = adminApiError(
      new AdminDataApiError("ADMIN_DATA_API_ERROR", "ABORT_ERR", "TRANSPORT"),
      { readOnly: true },
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "ADMIN_READ_UNAVAILABLE" });
  });

  it("does not turn a validation or client operation error into 503", async () => {
    const response = adminApiError(new Error("QUESTION_NOT_FOUND"), { readOnly: true });
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: "QUESTION_NOT_FOUND" });
  });

  it("does not change transport handling for write routes", () => {
    const response = adminApiError(
      new AdminDataApiError("ADMIN_DATA_API_ERROR", "ABORT_ERR", "TRANSPORT"),
    );
    expect(response.status).toBe(422);
  });
});
