import { resolve } from "node:path";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createCommandDatabaseConnection } from "../src/lib/db/connection";

async function main() {
  const connection = createCommandDatabaseConnection();
  try {
    await migrate(connection.db, { migrationsFolder: resolve("drizzle") });
    console.log("Database migrations applied.");
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
