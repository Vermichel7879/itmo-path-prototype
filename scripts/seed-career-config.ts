import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createCommandDatabaseConnection } from "../src/lib/db/connection";
import { validateCareerImport } from "../src/lib/db/import/import-model";
import { replaceDraftFromImport } from "../src/lib/db/import/write-draft";

async function main() {
  const snapshotPath = resolve("src/lib/db/seed/career-config-v2.json");
  const config = validateCareerImport(
    JSON.parse(await readFile(snapshotPath, "utf8")),
  );
  const connection = createCommandDatabaseConnection();
  try {
    const version = await replaceDraftFromImport(connection.db, config);
    console.log(`Seeded draft version ${version.versionNumber}, id ${version.id}`);
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
