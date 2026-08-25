import "server-only";

import { createDatabaseConnection } from "./connection";
import { requireReadDatabaseUrl } from "./environment";

type DatabaseConnection = ReturnType<typeof createDatabaseConnection>;

const globalDatabase = globalThis as typeof globalThis & {
  careerReadDatabase?: DatabaseConnection;
};

export function getReadDatabase() {
  if (!globalDatabase.careerReadDatabase) {
    globalDatabase.careerReadDatabase = createDatabaseConnection(
      requireReadDatabaseUrl(),
    );
  }
  return globalDatabase.careerReadDatabase.db;
}

/** Read-only compatibility alias. New code should state its intent explicitly. */
export const getDatabase = getReadDatabase;
