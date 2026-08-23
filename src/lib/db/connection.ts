import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { requireDatabaseUrl } from "./environment";
import * as schema from "./schema";

export function createDatabaseConnection(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    max: 1,
    prepare: false,
  });
  return {
    client,
    db: drizzle({ client, schema }),
  };
}

export function createCommandDatabaseConnection() {
  const connection = createDatabaseConnection(requireDatabaseUrl());
  return {
    db: connection.db,
    close: () => connection.client.end({ timeout: 5 }),
  };
}

export type CareerDatabase = ReturnType<typeof createDatabaseConnection>["db"];
