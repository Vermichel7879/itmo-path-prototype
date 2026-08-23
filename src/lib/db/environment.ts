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
  const result = postgresUrl.safeParse(environment.DATABASE_URL);
  if (result.success) return result.data;
  throw new Error(
    "DATABASE_URL не задан или некорректен. Создайте Supabase и добавьте PostgreSQL connection string в локальный .env.local; команда не выполняла подключение.",
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
