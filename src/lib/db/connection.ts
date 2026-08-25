import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { requireReadDatabaseUrl } from "./environment";
import * as schema from "./schema";

export const READ_DATABASE_CLIENT_OPTIONS = {
  max: 1,
  prepare: false,
} as const;

export function createDatabaseConnection(databaseUrl: string) {
  const client = postgres(databaseUrl, READ_DATABASE_CLIENT_OPTIONS);
  return {
    client,
    db: drizzle({ client, schema }),
  };
}

export function createCommandDatabaseConnection() {
  const connection = createDatabaseConnection(requireReadDatabaseUrl());
  return {
    db: connection.db,
    close: () => connection.client.end({ timeout: 5 }),
  };
}

export type CareerDatabase = ReturnType<typeof createDatabaseConnection>["db"];
export type CareerDatabaseExecutor = Omit<CareerDatabase, "$client">;
