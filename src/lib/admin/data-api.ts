import "server-only";

import { z } from "zod";

import {
  callAdminRpc,
  type AdminRpcCallOptions,
  type AdminRpcClient,
} from "@/lib/supabase/admin-rpc";

const roleSchema = z.enum(["ADMIN", "EDITOR"]);
const timestampSchema = z.iso.datetime({ offset: true });
const nullableTimestampSchema = timestampSchema.nullable();
const emptyResultSchema = z.object({ ok: z.literal(true) });

const loginContextSchema = z.object({
  failureCount: z.number().int().nonnegative(),
  user: z
    .object({
      id: z.uuid(),
      username: z.string(),
      passwordHash: z.string(),
      role: roleSchema,
      active: z.boolean(),
    })
    .nullable(),
});

const sessionSchema = z
  .object({
    sessionId: z.uuid(),
    userId: z.uuid(),
    username: z.string(),
    role: roleSchema,
    expiresAt: timestampSchema,
  })
  .nullable();

const userAuthSchema = z
  .object({
    id: z.uuid(),
    passwordHash: z.string(),
    active: z.boolean(),
  })
  .nullable();

const adminUsersSchema = z.array(
  z.object({
    id: z.uuid(),
    username: z.string(),
    role: roleSchema,
    active: z.boolean(),
    lastLoginAt: nullableTimestampSchema,
    createdAt: timestampSchema,
    activeSessions: z.number().int().nonnegative(),
  }),
);

const draftRecordSchema = z.object({
  id: z.uuid(),
  updatedAt: timestampSchema,
  snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  snapshot: z.unknown(),
});

const publishedSummarySchema = z
  .object({
    id: z.uuid(),
    versionNumber: z.number().int().positive(),
    publishedAt: timestampSchema,
  })
  .nullable();
const publishedSnapshotSchema = z
  .object({ id: z.uuid(), snapshot: z.unknown() })
  .nullable();

const versionsSchema = z.array(
  z.object({
    id: z.uuid(),
    versionNumber: z.number().int().positive(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    label: z.string().nullable(),
    createdAt: timestampSchema,
    publishedAt: nullableTimestampSchema,
    publisher: z.string().nullable(),
  }),
);

const auditEntriesSchema = z.array(
  z.object({
    id: z.number().int().nonnegative(),
    time: timestampSchema,
    username: z.string().nullable(),
    action: z.string(),
    entityType: z.string(),
    entityId: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()),
  }),
);

const idResultSchema = z.object({ id: z.uuid() });
const publishResultSchema = z.object({
  id: z.uuid(),
  versionNumber: z.number().int().positive(),
  publishedAt: timestampSchema,
});
const draftMutationResultSchema = z.object({
  id: z.uuid(),
  updatedAt: timestampSchema,
});

export interface AdminAuditFilters {
  username?: string;
  entityType?: string;
  action?: string;
  from?: string;
  to?: string;
}

export function createAdminDataApi(client?: AdminRpcClient) {
  const rpc = <T>(
    functionName: string,
    args: Record<string, unknown>,
    schema: z.ZodType<T>,
    options?: AdminRpcCallOptions,
  ) =>
    client
      ? callAdminRpc(functionName, args, schema, client, options)
      : callAdminRpc(functionName, args, schema, undefined, options);

  return {
    getLoginContext(input: {
      username: string;
      usernameHash: string;
      ipHash: string;
      windowStart: string;
    }) {
      return rpc(
        "admin_get_login_context",
        {
          p_username: input.username,
          p_username_hash: input.usernameHash,
          p_ip_hash: input.ipHash,
          p_window_start: input.windowStart,
        },
        loginContextSchema,
      );
    },
    recordFailedLogin(input: {
      usernameHash: string;
      ipHash: string;
      attemptedAt: string;
    }) {
      return rpc(
        "admin_record_failed_login",
        {
          p_username_hash: input.usernameHash,
          p_ip_hash: input.ipHash,
          p_attempted_at: input.attemptedAt,
        },
        emptyResultSchema,
      );
    },
    completeLogin(input: {
      userId: string;
      tokenHash: string;
      expiresAt: string;
      usernameHash: string;
      ipHash: string;
      attemptedAt: string;
    }) {
      return rpc(
        "admin_complete_login",
        {
          p_user_id: input.userId,
          p_token_hash: input.tokenHash,
          p_expires_at: input.expiresAt,
          p_username_hash: input.usernameHash,
          p_ip_hash: input.ipHash,
          p_attempted_at: input.attemptedAt,
        },
        z.object({ sessionId: z.uuid() }),
      );
    },
    resolveSession(tokenHash: string, now: string) {
      return rpc(
        "admin_resolve_session",
        { p_token_hash: tokenHash, p_now: now },
        sessionSchema,
        { retryTransportOnce: true, timeoutMs: 10_000 },
      );
    },
    revokeSession(tokenHash: string, revokedAt: string) {
      return rpc(
        "admin_revoke_session",
        { p_token_hash: tokenHash, p_revoked_at: revokedAt },
        emptyResultSchema,
      );
    },
    getUserAuth(userId: string) {
      return rpc("admin_get_user_auth", { p_user_id: userId }, userAuthSchema);
    },
    changePassword(input: {
      actorUserId: string;
      passwordHash: string;
      changedAt: string;
    }) {
      return rpc(
        "admin_change_password",
        {
          p_actor_user_id: input.actorUserId,
          p_password_hash: input.passwordHash,
          p_changed_at: input.changedAt,
        },
        emptyResultSchema,
      );
    },
    listUsers() {
      return rpc("admin_list_users", {}, adminUsersSchema);
    },
    mutateUser(input: {
      actorUserId: string;
      action: string;
      payload: Record<string, unknown>;
    }) {
      return rpc(
        "admin_mutate_user",
        {
          p_actor_user_id: input.actorUserId,
          p_action: input.action,
          p_payload: input.payload,
        },
        idResultSchema,
      );
    },
    getDraft() {
      return rpc(
        "admin_get_draft",
        {},
        draftRecordSchema,
        { retryTransportOnce: true, timeoutMs: 10_000 },
      );
    },
    mutateDraft(input: {
      actorUserId: string;
      expectedUpdatedAt: string;
      expectedSnapshotHash: string;
      mutation: Record<string, unknown>;
      audit: Record<string, unknown>;
    }) {
      return rpc(
        "admin_mutate_draft",
        {
          p_actor_user_id: input.actorUserId,
          p_expected_updated_at: input.expectedUpdatedAt,
          p_expected_snapshot_hash: input.expectedSnapshotHash,
          p_mutation: input.mutation,
          p_audit: input.audit,
        },
        draftMutationResultSchema,
      );
    },
    publishDraft(input: {
      actorUserId: string;
      expectedUpdatedAt: string;
      expectedSnapshotHash: string;
      label: string;
    }) {
      return rpc(
        "admin_publish_draft",
        {
          p_actor_user_id: input.actorUserId,
          p_expected_updated_at: input.expectedUpdatedAt,
          p_expected_snapshot_hash: input.expectedSnapshotHash,
          p_label: input.label,
        },
        publishResultSchema,
      );
    },
    getLatestPublishedSummary() {
      return rpc(
        "admin_get_latest_published_summary",
        {},
        publishedSummarySchema,
      );
    },
    getLatestPublishedSnapshot() {
      return rpc(
        "admin_get_latest_published_snapshot",
        {},
        publishedSnapshotSchema,
      );
    },
    listVersions() {
      return rpc("admin_list_versions", {}, versionsSchema);
    },
    listAudit(filters: AdminAuditFilters) {
      return rpc(
        "admin_list_audit",
        {
          p_username: filters.username ?? null,
          p_entity_type: filters.entityType ?? null,
          p_action: filters.action ?? null,
          p_from: filters.from ?? null,
          p_to: filters.to ?? null,
        },
        auditEntriesSchema,
      );
    },
  };
}

export const adminDataApi = createAdminDataApi();
