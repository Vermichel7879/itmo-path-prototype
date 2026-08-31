import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

import {
  AdminDataApiError,
  callAdminRpc,
  type AdminRpcClient,
} from "./admin-rpc";

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => undefined));
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

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

  it.each([
    "MAPPING_ALREADY_EXISTS",
    "MAPPING_AUDIENCE_INCOMPATIBLE",
    "MAPPING_NOT_FOUND",
    "ANSWER_NOT_FOUND",
    "MODULE_NOT_FOUND",
  ])("preserves the safe mapping error %s", async (message) => {
    const client: AdminRpcClient = {
      rpc: async () => ({ data: null, error: { code: "P0001", message } }),
    };
    await expect(
      callAdminRpc("admin_mutate_mapping", {}, z.unknown(), client),
    ).rejects.toEqual(new AdminDataApiError(message, "P0001"));
  });

  it.each([
    "MODULE_RECOMMENDATION_ALREADY_EXISTS",
    "MODULE_RECOMMENDATION_AUDIENCE_INCOMPATIBLE",
    "MODULE_RECOMMENDATION_NOT_FOUND",
    "RECOMMENDATION_NOT_FOUND",
  ])("preserves the safe module recommendation error %s", async (message) => {
    const client: AdminRpcClient = {
      rpc: async () => ({ data: null, error: { code: "P0001", message } }),
    };
    await expect(
      callAdminRpc("admin_mutate_module_recommendation", {}, z.unknown(), client),
    ).rejects.toEqual(new AdminDataApiError(message, "P0001"));
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

  it("retries one transport failure for a read-only session RPC", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "",
          message: "TypeError: fetch failed",
          details: "Caused by: Error: read ECONNRESET",
        },
      })
      .mockResolvedValueOnce({ data: { id: "session" }, error: null });
    const client: AdminRpcClient = { rpc };

    await expect(callAdminRpc(
      "admin_resolve_session",
      { p_token_hash: "a".repeat(64), p_now: "2026-08-31T12:00:00.000Z" },
      z.object({ id: z.string() }),
      client,
      { retryTransportOnce: true },
    )).resolves.toEqual({ id: "session" });

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith("[ADMIN_RPC_FAILED]", expect.objectContaining({
      rpcName: "admin_resolve_session",
      errorCode: "ECONNRESET",
      category: "TRANSPORT",
      attempt: 1,
      retrying: true,
    }));
  });

  it("does not retry permission, PostgREST, or schema errors", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const client: AdminRpcClient = { rpc };

    await expect(callAdminRpc(
      "admin_resolve_session",
      {},
      z.unknown(),
      client,
      { retryTransportOnce: true },
    )).rejects.toEqual(new AdminDataApiError("ADMIN_DATA_API_ERROR", "42501"));
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("does not retry a valid revoked or expired session response", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const client: AdminRpcClient = { rpc };
    await expect(callAdminRpc(
      "admin_resolve_session",
      {},
      z.object({ id: z.string() }).nullable(),
      client,
      { retryTransportOnce: true },
    )).resolves.toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("aborts and retries a timed-out read attempt only once", async () => {
    vi.useFakeTimers();
    const rpc = vi.fn(() => new Promise<never>(() => undefined));
    const client: AdminRpcClient = { rpc };
    const result = callAdminRpc(
      "admin_get_draft",
      {},
      z.unknown(),
      client,
      { retryTransportOnce: true, timeoutMs: 5 },
    );
    const rejection = expect(result).rejects.toMatchObject({
      code: "ABORT_ERR",
      category: "TRANSPORT",
    });
    await vi.runAllTimersAsync();
    await rejection;
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
