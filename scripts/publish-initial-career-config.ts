import "./load-project-environment";

import { createCommandDatabaseConnection } from "../src/lib/db/connection";
import { publishInitialCareerConfig } from "../src/lib/db/publish/initial-publish";

function safeError(error: unknown) {
  const candidates: Record<string, unknown>[] = [];
  let current = error;
  while (typeof current === "object" && current !== null) {
    const object = current as Record<string, unknown>;
    candidates.push(object);
    current = object.cause ?? object.originalError;
  }
  const source =
    [...candidates].reverse().find((candidate) => candidate.code) ??
    candidates.at(-1) ??
    candidates[0];
  const code = source?.code ? String(source.code) : "UNKNOWN";
  if (code === "CONNECTION_CLOSED" || code === "ECONNRESET") {
    return { code: "CONNECTION_CLOSED", message: "Database connection closed." };
  }
  const raw = source?.message ? String(source.message) : "Initial publish failed.";
  const message = raw
    .replace(/\b(?:postgres|postgresql):\/\/\S+/gi, "[REDACTED_URI]")
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[REDACTED_URI]")
    .slice(0, 500);
  return { code, message };
}

async function main() {
  const connection = createCommandDatabaseConnection();
  try {
    const result = await publishInitialCareerConfig(connection.db);
    console.log(`INITIAL_PUBLISH=${result.status}`);
    console.log(`PUBLISHED_CONFIG_ID=${result.publishedConfigId}`);
    console.log(`DRAFT_CONFIG_ID=${result.draftConfigId}`);
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  const safe = safeError(error);
  console.error("INITIAL_PUBLISH=FAILED");
  console.error(`ERROR_CODE=${safe.code}`);
  console.error(`ERROR_MESSAGE=${safe.message}`);
  process.exitCode = 1;
});
