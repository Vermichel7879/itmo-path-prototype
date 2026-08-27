import "server-only";

import { z } from "zod";

import { getSupabaseAdminClient } from "./admin-client";

const safeRpcMessages = new Set([
  "ADMIN_ACTOR_INVALID",
  "ADMIN_DATA_INVALID",
  "ADMIN_DATA_API_RESPONSE_INVALID",
  "ADMIN_USER_NOT_FOUND",
  "ADMIN_USERNAME_EXISTS",
  "ANSWER_ID_QUESTION_MISMATCH",
  "DRAFT_CONFIG_MISSING",
  "DRAFT_MUTATION_INVALID_CONFIG",
  "DRAFT_STALE_REVISION",
  "LAST_ACTIVE_ADMIN_PROTECTED",
  "MAPPING_ALREADY_EXISTS",
  "MAPPING_AUDIENCE_INCOMPATIBLE",
  "MAPPING_NOT_FOUND",
  "MODULE_RECOMMENDATION_ALREADY_EXISTS",
  "MODULE_RECOMMENDATION_AUDIENCE_INCOMPATIBLE",
  "MODULE_RECOMMENDATION_NOT_FOUND",
  "MODULE_NOT_FOUND",
  "RECOMMENDATION_NOT_FOUND",
  "ANSWER_NOT_FOUND",
  "OPPORTUNITY_CREATE_FIELDS_REQUIRED",
  "PUBLISH_BLOCKED_BY_VALIDATION",
  "QUESTION_NOT_FOUND",
  "WEIGHT_REFERENCE_NOT_FOUND",
  "TRAJECTORY_SESSION_NOT_FOUND",
  "TRAJECTORY_SESSION_NOT_IN_PROGRESS",
  "TRAJECTORY_SESSION_CONFIG_MISMATCH",
  "TRAJECTORY_ANSWER_INVALID",
  "TRAJECTORY_COMPLETION_INVALID",
]);

interface AdminRpcErrorShape {
  code?: string | null;
  message?: string | null;
}

export interface AdminRpcClient {
  rpc(
    functionName: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: AdminRpcErrorShape | null }>;
}

export class AdminDataApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "AdminDataApiError";
  }
}

function safeCode(code: string | null | undefined) {
  return code && /^[A-Z0-9_-]{1,64}$/i.test(code) ? code : "UNKNOWN";
}

export async function callAdminRpc<T>(
  functionName: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
  client: AdminRpcClient = getSupabaseAdminClient() as unknown as AdminRpcClient,
): Promise<T> {
  const { data, error } = await client.rpc(functionName, args);
  if (error) {
    const message =
      error.message && safeRpcMessages.has(error.message)
        ? error.message
        : "ADMIN_DATA_API_ERROR";
    throw new AdminDataApiError(message, safeCode(error.code));
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new AdminDataApiError("ADMIN_DATA_API_RESPONSE_INVALID", "INVALID_RESPONSE");
  }
  return parsed.data;
}
