import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

import {
  AdminDataApiError,
  callAdminRpc,
  type AdminRpcClient,
} from "./admin-rpc";

describe("admin Data API RPC boundary", () => {
  it("maps a typed RPC response", async () => {
    const client: AdminRpcClient = {
      rpc: async () => ({ data: { id: "result-id" }, error: null }),
    };
    await expect(
      callAdminRpc("admin_test", {}, z.object({ id: z.string() }), client),
    ).resolves.toEqual({ id: "result-id" });
  });

  it("preserves allowlisted domain conflicts without returning database details", async () => {
    const client: AdminRpcClient = {
      rpc: async () => ({
        data: null,
        error: { code: "P0001", message: "DRAFT_STALE_REVISION" },
      }),
    };
    await expect(
      callAdminRpc("admin_test", {}, z.unknown(), client),
    ).rejects.toEqual(
      new AdminDataApiError("DRAFT_STALE_REVISION", "P0001"),
    );
  });

  it("replaces unknown PostgREST messages with a safe generic error", async () => {
    const client: AdminRpcClient = {
      rpc: async () => ({
        data: null,
        error: {
          code: "42501",
          message: "credential and database host must not escape",
        },
      }),
    };
    await expect(
      callAdminRpc("admin_test", {}, z.unknown(), client),
    ).rejects.toEqual(new AdminDataApiError("ADMIN_DATA_API_ERROR", "42501"));
  });
});
