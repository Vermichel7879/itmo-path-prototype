import { createHash, timingSafeEqual } from "node:crypto";

import postgres, { type Sql } from "postgres";

import { requireTransactionDatabaseUrl } from "./environment";

export const DB_WRITE_PROBE_SECRET_HEADER = "x-db-write-probe-secret";
export const PREVIEW_WRITE_PROBE_AUTOMATIC_RETRY = false as const;
export const PREVIEW_WRITE_PROBE_CLIENT_OPTIONS = {
  ssl: "require",
  max: 1,
  prepare: false,
  fetch_types: false,
  idle_timeout: 10,
  max_lifetime: 60,
} as const;

const DATABASE_OPERATION_TIMEOUT_MS = 12_000;

export type SafeWriteProbeResult =
  | { ok: true; result: "VERCEL_WRITE_CONNECTION_OK" }
  | { ok: false; errorCode: string; message: string };
export type PreviewWriteProbeAccess =
  | { allowed: true }
  | { allowed: false; status: number; result: SafeWriteProbeResult };

type ReservedClient = Awaited<ReturnType<Sql["reserve"]>>;

function withTimeout<T>(operation: PromiseLike<T>, stage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`${stage} timed out`)),
      DATABASE_OPERATION_TIMEOUT_MS,
    );

    Promise.resolve(operation).then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function safeProbeSecretEquals(
  providedSecret: string | null,
  configuredSecret: string,
): boolean {
  if (!providedSecret || !configuredSecret) return false;
  return timingSafeEqual(digest(providedSecret), digest(configuredSecret));
}

export function authorizePreviewWriteProbe(
  providedSecret: string | null,
  environment: Record<string, string | undefined> = process.env,
): PreviewWriteProbeAccess {
  if (environment.VERCEL_ENV !== "preview") {
    return {
      allowed: false,
      status: 404,
      result: { ok: false, errorCode: "NOT_FOUND", message: "Not found" },
    };
  }

  const configuredSecret = environment.DB_WRITE_PROBE_SECRET;
  if (!configuredSecret || configuredSecret.length < 32) {
    return {
      allowed: false,
      status: 503,
      result: {
        ok: false,
        errorCode: "PROBE_NOT_CONFIGURED",
        message: "Write probe is not configured",
      },
    };
  }

  if (!safeProbeSecretEquals(providedSecret, configuredSecret)) {
    return {
      allowed: false,
      status: 401,
      result: { ok: false, errorCode: "UNAUTHORIZED", message: "Unauthorized" },
    };
  }

  return { allowed: true };
}

function errorCandidates(error: unknown): Record<string, unknown>[] {
  const candidates: Record<string, unknown>[] = [];
  const seen = new Set<unknown>();
  const visit = (candidate: unknown) => {
    if (!candidate || typeof candidate !== "object" || seen.has(candidate)) {
      return;
    }
    seen.add(candidate);
    const record = candidate as Record<string, unknown>;
    candidates.push(record);
    visit(record.cause);
    visit(record.originalError);
    if (Array.isArray(record.errors)) record.errors.forEach(visit);
  };
  visit(error);
  return candidates;
}

function safeErrorCode(value: unknown): string {
  const code =
    typeof value === "string" || typeof value === "number"
      ? String(value)
      : "UNKNOWN";
  return /^[A-Z0-9_-]{1,64}$/i.test(code) ? code : "UNKNOWN";
}

function sanitizeWriteProbeMessage(message: string): string {
  const sensitiveValues = new Set<string>([
    process.env.DB_WRITE_PROBE_SECRET ?? "",
    process.env.TRANSACTION_DATABASE_URL ?? "",
    process.env.ADMIN_DATABASE_URL ?? "",
    process.env.DATABASE_URL ?? "",
    process.env.DIRECT_DATABASE_URL ?? "",
  ]);

  for (const rawUrl of [
    process.env.TRANSACTION_DATABASE_URL,
    process.env.ADMIN_DATABASE_URL,
    process.env.DATABASE_URL,
    process.env.DIRECT_DATABASE_URL,
  ]) {
    if (!rawUrl) continue;
    try {
      const parsed = new URL(rawUrl);
      sensitiveValues.add(parsed.hostname);
      sensitiveValues.add(parsed.host);
      sensitiveValues.add(parsed.username);
      sensitiveValues.add(parsed.password);
      sensitiveValues.add(decodeURIComponent(parsed.username));
      sensitiveValues.add(decodeURIComponent(parsed.password));
      const usernameProjectRef = parsed.username.split(".").at(-1);
      const hostnameProjectRef = parsed.hostname.split(".")[1];
      if (usernameProjectRef) sensitiveValues.add(usernameProjectRef);
      if (hostnameProjectRef) sensitiveValues.add(hostnameProjectRef);
    } catch {
      // The complete invalid value is already included in the redaction set.
    }
  }

  let sanitized = message
    .replace(/(?:postgres(?:ql)?|https?):\/\/[^\s"']+/gi, "[REDACTED_URI]")
    .replace(
      /\b(?:[a-z0-9-]+\.)+(?:supabase\.com|supabase\.co)\b/gi,
      "[REDACTED_HOST]",
    )
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[REDACTED_IP]")
    .replace(/\b(?:[0-9a-f]{0,4}:){2,}[0-9a-f]{0,4}\b/gi, "[REDACTED_IP]");
  for (const value of [...sensitiveValues]
    .filter((item) => item.length >= 3)
    .sort((left, right) => right.length - left.length)) {
    sanitized = sanitized.split(value).join("[REDACTED]");
  }
  return sanitized.slice(0, 500);
}

export function toSafeWriteProbeError(error: unknown): SafeWriteProbeResult {
  const candidates = errorCandidates(error);
  const source =
    candidates.find((candidate) => candidate.code) ?? candidates.at(-1);
  const rawMessage =
    typeof source?.message === "string"
      ? source.message
      : error instanceof Error
        ? error.message
        : "Write connection probe failed";
  const message = sanitizeWriteProbeMessage(rawMessage);

  return {
    ok: false,
    errorCode: safeErrorCode(source?.code),
    message,
  };
}

async function rollbackQuietly(reserved: ReservedClient): Promise<void> {
  await withTimeout(reserved.unsafe("rollback"), "ROLLBACK").catch(
    () => undefined,
  );
}

export async function executeRollbackOnlyWriteProbe(
  client: Sql,
): Promise<void> {
  let reserved: ReservedClient | undefined;
  let transactionStarted = false;

  try {
    reserved = await withTimeout(client.reserve(), "RESERVE");
    await withTimeout(reserved.unsafe("select 1"), "SELECT 1");
    await withTimeout(reserved.unsafe("begin"), "BEGIN");
    transactionStarted = true;
    await withTimeout(
      reserved.unsafe(`
        create temporary table vercel_admin_write_probe (
          probe_value integer not null
        ) on commit drop
      `),
      "CREATE TEMPORARY TABLE",
    );
    await withTimeout(
      reserved.unsafe(
        "insert into vercel_admin_write_probe (probe_value) values ($1)",
        [1],
      ),
      "INSERT",
    );
    const verification = await withTimeout(
      reserved.unsafe<{ rowCount: number; probeValue: number }[]>(`
        select
          count(*)::integer as "rowCount",
          min(probe_value)::integer as "probeValue"
        from vercel_admin_write_probe
      `),
      "VERIFY INSERT",
    );
    if (
      verification.length !== 1 ||
      verification[0]?.rowCount !== 1 ||
      verification[0]?.probeValue !== 1
    ) {
      throw new Error("Temporary write verification failed");
    }
    await withTimeout(reserved.unsafe("rollback"), "ROLLBACK");
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted && reserved) await rollbackQuietly(reserved);
    throw error;
  } finally {
    try {
      reserved?.release();
    } catch {
      // Closing the isolated client below also releases the connection.
    }
  }
}

export async function runVercelWriteProbe(): Promise<SafeWriteProbeResult> {
  let client: Sql | undefined;
  try {
    client = postgres(
      requireTransactionDatabaseUrl(),
      PREVIEW_WRITE_PROBE_CLIENT_OPTIONS,
    );
    await executeRollbackOnlyWriteProbe(client);
    return { ok: true, result: "VERCEL_WRITE_CONNECTION_OK" };
  } catch (error) {
    return toSafeWriteProbeError(error);
  } finally {
    await client?.end({ timeout: 5 }).catch(() => undefined);
  }
}
