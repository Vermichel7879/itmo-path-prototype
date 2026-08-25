import { describe, expect, it, vi } from "vitest";

import type { AdminRpcClient } from "@/lib/supabase/admin-rpc";

vi.mock("server-only", () => ({}));

import { createAdminDataApi } from "./data-api";

const actorId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const configId = "00000000-0000-4000-8000-000000000003";
const timestamp = "2026-08-24T12:00:00.000Z";
const hash = "a".repeat(64);

function rpcClient(data: unknown) {
  const rpc = vi.fn(async () => ({ data, error: null }));
  return { client: { rpc } as AdminRpcClient, rpc };
}

describe("admin domain RPC mappings", () => {
  it("maps login completion without sending plaintext credentials", async () => {
    const { client, rpc } = rpcClient({ sessionId: userId });
    const api = createAdminDataApi(client);

    await api.completeLogin({
      userId,
      tokenHash: hash,
      expiresAt: timestamp,
      usernameHash: hash,
      ipHash: hash,
      attemptedAt: timestamp,
    });

    expect(rpc).toHaveBeenCalledWith("admin_complete_login", {
      p_user_id: userId,
      p_token_hash: hash,
      p_expires_at: timestamp,
      p_username_hash: hash,
      p_ip_hash: hash,
      p_attempted_at: timestamp,
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("password");
  });

  it("maps user mutation to the single atomic user RPC", async () => {
    const { client, rpc } = rpcClient({ id: userId });
    const api = createAdminDataApi(client);

    await api.mutateUser({
      actorUserId: actorId,
      action: "SET_ACTIVE",
      payload: { userId, active: false },
    });

    expect(rpc).toHaveBeenCalledWith("admin_mutate_user", {
      p_actor_user_id: actorId,
      p_action: "SET_ACTIVE",
      p_payload: { userId, active: false },
    });
  });

  it("maps optimistic draft mutation with both revision tokens", async () => {
    const { client, rpc } = rpcClient({ id: configId, updatedAt: timestamp });
    const api = createAdminDataApi(client);

    await api.mutateDraft({
      actorUserId: actorId,
      expectedUpdatedAt: timestamp,
      expectedSnapshotHash: hash,
      mutation: { entityType: "QUESTION", stableId: "Q1", values: { text: "x" } },
      nextSnapshot: { questions: [] },
      audit: { changedFields: ["text"] },
    });

    expect(rpc).toHaveBeenCalledWith(
      "admin_mutate_draft",
      expect.objectContaining({
        p_actor_user_id: actorId,
        p_expected_updated_at: timestamp,
        p_expected_snapshot_hash: hash,
      }),
    );
  });

  it("maps publish to one atomic RPC with expected revision and hash", async () => {
    const { client, rpc } = rpcClient({
      id: configId,
      versionNumber: 3,
      publishedAt: timestamp,
    });
    const api = createAdminDataApi(client);

    await api.publishDraft({
      actorUserId: actorId,
      expectedUpdatedAt: timestamp,
      expectedSnapshotHash: hash,
      label: "Release",
    });

    expect(rpc).toHaveBeenCalledWith("admin_publish_draft", {
      p_actor_user_id: actorId,
      p_expected_updated_at: timestamp,
      p_expected_snapshot_hash: hash,
      p_label: "Release",
    });
  });
});
