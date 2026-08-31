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
  details?: string | null;
  hint?: string | null;
}

export interface AdminRpcClient {
  rpc(
    functionName: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: AdminRpcErrorShape | null }> & {
    abortSignal?: (
      signal: AbortSignal,
    ) => PromiseLike<{ data: unknown; error: AdminRpcErrorShape | null }>;
  };
}

export class AdminDataApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly category = code.startsWith("PGRST")
      ? "POSTGREST"
      : /^[0-9A-Z]{5}$/i.test(code)
        ? "POSTGRES"
        : "UNKNOWN",
  ) {
    super(message);
    this.name = "AdminDataApiError";
  }
}

export interface AdminRpcCallOptions {
  retryTransportOnce?: boolean;
  timeoutMs?: number;
}

function safeCode(code: string | null | undefined) {
  return code && /^[A-Z0-9_-]{1,64}$/i.test(code) ? code : "UNKNOWN";
}

function payloadBytes(args: Record<string, unknown>) {
  return new TextEncoder().encode(JSON.stringify(args)).byteLength;
}

function extractedTransportCode(error: AdminRpcErrorShape) {
  const source = `${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""}`;
  return source.match(/\b(ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENETUNREACH|EAI_AGAIN|UND_ERR_[A-Z_]+|ABORT_ERR)\b/i)?.[1]?.toUpperCase();
}

function errorCategory(error: AdminRpcErrorShape) {
  const explicitCode = safeCode(error.code);
  if (explicitCode !== "UNKNOWN") {
    if (extractedTransportCode(error)) return "TRANSPORT";
    if (explicitCode.startsWith("PGRST")) return "POSTGREST";
    return "POSTGRES";
  }
  const source = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`;
  return /fetch failed|network|socket|connection reset|timed?\s*out|aborted|ECONN|ETIMEDOUT|EAI_AGAIN|UND_ERR/i.test(source)
    ? "TRANSPORT"
    : "UNKNOWN";
}

function sanitizedRpcMessage(value: string | null | undefined) {
  let message = value || "UNKNOWN";
  for (const secret of [
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_URL,
    process.env.ADMIN_SECURITY_SECRET,
  ]) {
    if (secret) message = message.replaceAll(secret, "[REDACTED]");
  }
  return message
    .replace(/\b(?:https?|postgres(?:ql)?):\/\/\S+/gi, "[REDACTED_URI]")
    .replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi, "[REDACTED_HOST]")
    .slice(0, 400);
}

function logRpcFailure(
  functionName: string,
  args: Record<string, unknown>,
  error: AdminRpcErrorShape,
  startedAt: number,
  attempt: number,
  retrying: boolean,
) {
  const category = errorCategory(error);
  const code = safeCode(error.code) === "UNKNOWN"
    ? safeCode(extractedTransportCode(error))
    : safeCode(error.code);
  console.error("[ADMIN_RPC_FAILED]", {
    rpcName: functionName,
    errorCode: code,
    errorMessage: sanitizedRpcMessage(error.message),
    durationMs: Date.now() - startedAt,
    category,
    payloadBytes: payloadBytes(args),
    attempt,
    retrying,
  });
}

async function rpcAttempt(
  client: AdminRpcClient,
  functionName: string,
  args: Record<string, unknown>,
  timeoutMs: number | undefined,
) {
  const request = client.rpc(functionName, args);
  if (!timeoutMs) return request;
  const controller = new AbortController();
  const abortable = request.abortSignal?.(controller.signal) ?? request;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<{ data: null; error: AdminRpcErrorShape }>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({
        data: null,
        error: {
          code: "ABORT_ERR",
          message: `Request aborted after ${timeoutMs}ms timeout`,
        },
      });
    }, timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve(abortable), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function callAdminRpc<T>(
  functionName: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
  client: AdminRpcClient = getSupabaseAdminClient() as unknown as AdminRpcClient,
  options: AdminRpcCallOptions = {},
): Promise<T> {
  const maxAttempts = options.retryTransportOnce ? 2 : 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const startedAt = Date.now();
    const { data, error } = await rpcAttempt(
      client,
      functionName,
      args,
      options.timeoutMs,
    );
    if (error) {
      const category = errorCategory(error);
      const retrying = category === "TRANSPORT" && attempt < maxAttempts;
      logRpcFailure(functionName, args, error, startedAt, attempt, retrying);
      if (retrying) continue;
      const message =
        error.message && safeRpcMessages.has(error.message)
          ? error.message
          : "ADMIN_DATA_API_ERROR";
      const code = safeCode(error.code) === "UNKNOWN"
        ? safeCode(extractedTransportCode(error))
        : safeCode(error.code);
      throw new AdminDataApiError(message, code, category);
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      throw new AdminDataApiError("ADMIN_DATA_API_RESPONSE_INVALID", "INVALID_RESPONSE", "RESPONSE");
    }
    return parsed.data;
  }
  throw new AdminDataApiError("ADMIN_DATA_API_ERROR", "UNKNOWN");
}
