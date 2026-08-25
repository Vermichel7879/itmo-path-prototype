import "./load-project-environment";

import { resolve } from "node:path";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabaseConnection } from "../src/lib/db/connection";
import { requireMigrationDatabaseUrl } from "../src/lib/db/environment";

async function main() {
  const connection = createDatabaseConnection(requireMigrationDatabaseUrl());
  try {
    await migrate(connection.db, { migrationsFolder: resolve("drizzle") });
    console.log("Database migrations applied.");
  } finally {
    await connection.client.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
