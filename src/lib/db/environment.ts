import { z } from "zod";

const postgresUrl = z.string().trim().min(1).refine(
  (value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "postgres:" || protocol === "postgresql:";
    } catch {
      return false;
    }
  },
  { message: "ожидается PostgreSQL connection string" },
);

export const READ_DATABASE_ENV_NAME = "TRANSACTION_DATABASE_URL" as const;
type DatabaseEnvironment = Record<string, string | undefined>;

export function requireDatabaseUrl(
  environment: DatabaseEnvironment = process.env,
): string {
  return requireReadDatabaseUrl(environment);
}

export function requireReadDatabaseUrl(
  environment: DatabaseEnvironment = process.env,
): string {
  return requireTransactionDatabaseUrl(environment);
}

export function requireTransactionDatabaseUrl(
  environment: DatabaseEnvironment = process.env,
): string {
  const result = postgresUrl.safeParse(environment.TRANSACTION_DATABASE_URL);
  if (result.success) return result.data;
  throw new Error(
    "TRANSACTION_DATABASE_URL must contain a valid PostgreSQL connection string.",
  );
}

export function requireMigrationDatabaseUrl(
  environment: DatabaseEnvironment = process.env,
): string {
  const result = postgresUrl.safeParse(
    environment.DIRECT_DATABASE_URL ?? environment.DATABASE_URL,
  );
  if (result.success) return result.data;
  throw new Error(
    "DIRECT_DATABASE_URL or DATABASE_URL must contain a valid PostgreSQL connection string.",
  );
}
