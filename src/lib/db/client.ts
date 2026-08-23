import "server-only";

import { createDatabaseConnection } from "./connection";
import { requireDatabaseUrl } from "./environment";

type DatabaseConnection = ReturnType<typeof createDatabaseConnection>;

const globalDatabase = globalThis as typeof globalThis & {
  careerDatabase?: DatabaseConnection;
};

export function getDatabase() {
  if (!globalDatabase.careerDatabase) {
    globalDatabase.careerDatabase = createDatabaseConnection(requireDatabaseUrl());
  }
  return globalDatabase.careerDatabase.db;
}
