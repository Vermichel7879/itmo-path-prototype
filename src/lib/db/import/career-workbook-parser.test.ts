import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  parseCareerWorkbook,
  summarizeCareerImport,
} from "./career-workbook-parser";
import { validateCareerImport } from "./import-model";

const sourcePath = resolve(
  "source/Карьерная_траектория_ЦКО_источник_v2.xlsx",
);

describe("career workbook parser", () => {
  it.runIf(existsSync(sourcePath))(
    "parses and validates the current source workbook",
    async () => {
      const config = await parseCareerWorkbook(sourcePath);

      expect(summarizeCareerImport(config)).toMatchObject({
        questions: 10,
        answers: 75,
        mappings: 52,
        modules: 11,
        recommendations: 22,
        modifiers: 12,
        entrepreneurStages: 5,
        entrepreneurChallenges: 8,
      });
      expect(config.entrepreneurStages.map((item) => item.answerStableId)).toEqual([
        "Q9_A1",
        "Q9_A2",
        "Q9_A3",
        "Q9_A4",
        "Q9_A5",
      ]);
    },
  );

  it("contains the database-level published immutability guard", async () => {
    const migration = await readFile(
      resolve("drizzle/0001_immutable-published-config.sql"),
      "utf8",
    );
    expect(migration).toContain("config_versions_published_snapshot");
    expect(migration).toContain("config_versions_published_immutable");
    expect(migration).toContain("Published configuration versions are immutable");
  });

  it("validates the checked-in seed without reading Excel", async () => {
    const snapshot = JSON.parse(
      await readFile(resolve("src/lib/db/seed/career-config-v2.json"), "utf8"),
    );
    const config = validateCareerImport(snapshot);
    expect(config.source.sha256).toBe(
      "EFC16A1C08A5019C05962ADD9C6390FB03F9DE9A28AA56FE3495A7F1C76181F2",
    );
    expect(config.modules).toHaveLength(11);
  });
});
