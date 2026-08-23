import "./load-project-environment";

import { resolve } from "node:path";

import {
  diffCareerImports,
  parseCareerWorkbook,
  summarizeCareerImport,
} from "../src/lib/db/import/career-workbook-parser";

const sourcePath = resolve(
  "source/Карьерная_траектория_ЦКО_источник_v2.xlsx",
);

function printSummary(summary: ReturnType<typeof summarizeCareerImport>) {
  console.log("Excel import validation: OK");
  console.log(`Questions: ${summary.questions}`);
  console.log(`Answers: ${summary.answers}`);
  console.log(`Mappings: ${summary.mappings}`);
  console.log(`Modules: ${summary.modules}`);
  console.log(`Recommendations: ${summary.recommendations}`);
  console.log(`Module recommendations: ${summary.moduleRecommendations}`);
  console.log(`Modifiers: ${summary.modifiers}`);
  console.log(`Entrepreneur stages: ${summary.entrepreneurStages}`);
  console.log(`Entrepreneur challenges: ${summary.entrepreneurChallenges}`);
  console.log(`Rules: ${summary.engineRules}`);
  console.log(`Documentation examples: ${summary.documentationExamples}`);
}

async function main() {
  const write = process.argv.includes("--write");
  const dryRun = process.argv.includes("--dry-run");
  if (write === dryRun) {
    throw new Error("Укажите ровно один режим: --dry-run или --write");
  }

  const config = await parseCareerWorkbook(sourcePath);
  console.log(`Source: ${config.source.fileName}`);
  console.log(`SHA-256: ${config.source.sha256}`);
  console.log(`Workbook version: ${config.source.workbookVersion}`);
  console.log(`Recognized sheets: ${config.source.recognizedSheets.join(", ")}`);
  printSummary(summarizeCareerImport(config));

  if (dryRun) {
    const diff = diffCareerImports(null, config);
    console.log("Diff baseline: empty draft (database connection was not used)");
    for (const [collection, changes] of Object.entries(diff)) {
      console.log(
        `${collection}: +${changes.added.length} ~${changes.changed.length} -${changes.removed.length}`,
      );
    }
    console.log("Dry run complete: no database writes performed.");
    return;
  }

  const [{ createCommandDatabaseConnection }, { replaceDraftFromImport }] =
    await Promise.all([
      import("../src/lib/db/connection"),
      import("../src/lib/db/import/write-draft"),
    ]);
  const connection = createCommandDatabaseConnection();
  try {
    const version = await replaceDraftFromImport(connection.db, config);
    console.log(
      `Draft imported: version ${version.versionNumber}, id ${version.id}`,
    );
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
