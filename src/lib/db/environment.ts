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

const adminSeedSchema = z
  .object({
    login: z.string().trim().min(3),
    password: z.string().min(12),
  })
  .strict();

export function requireDatabaseUrl(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  return requireTransactionDatabaseUrl(environment);
}

export function requireTransactionDatabaseUrl(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const result = postgresUrl.safeParse(environment.TRANSACTION_DATABASE_URL);
  if (result.success) return result.data;
  throw new Error(
    "TRANSACTION_DATABASE_URL must contain a valid PostgreSQL connection string.",
  );
}

export function requireMigrationDatabaseUrl(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const result = postgresUrl.safeParse(
    environment.DIRECT_DATABASE_URL ?? environment.DATABASE_URL,
  );
  if (result.success) return result.data;
  throw new Error(
    "DIRECT_DATABASE_URL or DATABASE_URL must contain a valid PostgreSQL connection string.",
  );
}

export function readInitialAdminCredentials(
  environment: NodeJS.ProcessEnv = process.env,
): z.infer<typeof adminSeedSchema> | null {
  const login = environment.INITIAL_ADMIN_LOGIN;
  const password = environment.INITIAL_ADMIN_PASSWORD;
  if (!login && !password) return null;
  if (!login || !password) {
    throw new Error(
      "INITIAL_ADMIN_LOGIN и INITIAL_ADMIN_PASSWORD должны быть заданы вместе.",
    );
  }
  return adminSeedSchema.parse({ login, password });
}
