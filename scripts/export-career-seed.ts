import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { parseCareerWorkbook } from "../src/lib/db/import/career-workbook-parser";

async function main() {
  const sourcePath = resolve(
    "source/Карьерная_траектория_ЦКО_источник_v2.xlsx",
  );
  const outputPath = resolve("src/lib/db/seed/career-config-v2.json");
  const config = await parseCareerWorkbook(sourcePath);
  await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  console.log(`Validated seed snapshot written to ${outputPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
