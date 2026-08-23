import "./load-project-environment";

import { sql } from "drizzle-orm";

import { createCommandDatabaseConnection } from "../src/lib/db/connection";

function safeFailureReason(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  if (code === "28P01") return "AUTHENTICATION_FAILED";
  if (code === "3D000") return "DATABASE_NOT_FOUND";
  if (code === "ENOTFOUND") return "DNS_FAILED";
  if (code === "ECONNREFUSED") return "CONNECTION_REFUSED";
  if (code === "ETIMEDOUT" || code === "CONNECT_TIMEOUT") return "TIMEOUT";
  return "CONNECTION_ERROR";
}

async function main() {
  const connection = createCommandDatabaseConnection();
  try {
    await connection.db.execute(sql`select current_database()`);
    console.log("DATABASE_CONNECTION=OK");
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  console.error(`DATABASE_CONNECTION=FAILED reason=${safeFailureReason(error)}`);
  process.exitCode = 1;
});
