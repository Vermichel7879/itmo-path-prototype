import "./load-project-environment";

import { resolve } from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { requireTransactionDatabaseUrl } from "../src/lib/db/environment";

type ErrorRecord = Record<string, unknown>;

const diagnosticFields = [
  "code",
  "message",
  "detail",
  "hint",
  "position",
  "schema",
  "table",
  "constraint",
  "routine",
] as const;

function asErrorRecord(value: unknown): ErrorRecord | null {
  return typeof value === "object" && value !== null
    ? (value as ErrorRecord)
    : null;
}

function collectErrors(error: unknown): ErrorRecord[] {
  const records: ErrorRecord[] = [];
  const queue: unknown[] = [error];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);

    const record = asErrorRecord(current);
    if (!record) continue;
    records.push(record);

    queue.push(record.cause, record.originalError);
    if (Array.isArray(record.errors)) queue.push(...record.errors);
  }

  return records;
}

function connectionSecrets(): string[] {
  const values = [
    process.env.DATABASE_URL,
    process.env.TRANSACTION_DATABASE_URL,
    process.env.DIRECT_DATABASE_URL,
  ].filter((value): value is string => Boolean(value));

  const secrets = new Set(values);
  for (const value of values) {
    try {
      const url = new URL(value);
      const username = decodeURIComponent(url.username);
      const password = decodeURIComponent(url.password);
      const projectRef = username.includes(".")
        ? username.slice(username.lastIndexOf(".") + 1)
        : url.hostname.split(".")[1];

      for (const secret of [
        url.hostname,
        url.username,
        url.password,
        username,
        password,
        projectRef,
      ]) {
        if (secret) secrets.add(secret);
      }
    } catch {
      // The full invalid value is already included in the redaction set.
    }
  }

  return [...secrets].sort((left, right) => right.length - left.length);
}

function sanitize(value: unknown, secrets: string[]): string {
  let output = String(value);
  for (const secret of secrets) {
    output = output.split(secret).join("[REDACTED]");
  }

  return output
    .replace(/\bpostgres(?:ql)?:\/\/\S+/gi, "[REDACTED_URI]")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

function reportMigrationError(error: unknown) {
  const records = collectErrors(error);
  const secrets = connectionSecrets();
  const primary = records.find((record) => diagnosticFields
    .filter((field) => field !== "message")
    .some((field) => record[field] !== undefined && record[field] !== ""))
    ?? records.find((record) => record.message !== undefined)
    ?? records[0];

  const constructorValue = primary?.constructor;
  const name = primary?.name
    ?? (typeof constructorValue === "function" ? constructorValue.name : null);

  if (name) console.error(`ERROR_NAME=${sanitize(name, secrets)}`);

  for (const field of diagnosticFields) {
    const value = primary?.[field]
      ?? records.map((record) => record[field]).find(
        (candidate) => candidate !== undefined && candidate !== "",
      );
    if (value !== undefined && value !== "") {
      console.error(`ERROR_${field.toUpperCase()}=${sanitize(value, secrets)}`);
    }
  }
}

async function main() {
  const client = postgres(requireTransactionDatabaseUrl(), {
    max: 1,
    prepare: false,
  });

  let failure: unknown;
  try {
    await migrate(drizzle({ client }), {
      migrationsFolder: resolve("drizzle"),
    });
    console.log("Transaction pooler migrations applied.");
  } catch (error) {
    failure = error;
  }

  try {
    await client.end({ timeout: 5 });
  } catch (error) {
    failure ??= error;
  }

  if (failure) throw failure;
}

main().catch((error: unknown) => {
  reportMigrationError(error);
  process.exitCode = 1;
});
