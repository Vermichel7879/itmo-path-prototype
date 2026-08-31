import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("pinned questionnaire Data API migration", () => {
  const sql = readFileSync(resolve("drizzle/0009_public-pinned-questionnaire.sql"), "utf8");

  it("reads only the requested published version from its snapshot", () => {
    expect(sql).toContain("public_get_pinned_questionnaire");
    expect(sql).toContain("version.id = p_config_version_id");
    expect(sql).toContain("version.status = 'PUBLISHED'");
    expect(sql).toContain("version.snapshot");
    expect(sql).toContain("pinned.snapshot -> 'questions'");
    expect(sql).toContain("pinned.snapshot -> 'answers'");
    expect(sql).toContain("pinned.snapshot -> 'engineRules'");
    expect(sql).not.toMatch(/FROM public\.(questions|answers|engine_rules)/i);
    expect(sql).not.toMatch(/latest|published_at\s+desc/i);
  });

  it("filters active items and audience while preserving source sort order", () => {
    expect(sql).toMatch(/question\.item ->> 'active'[\s\S]*forBachelor[\s\S]*forMaster/);
    expect(sql).toMatch(/answer\.item ->> 'active'/);
    expect(sql).toMatch(/questionStableId'[\s\S]*stableId'/);
    expect(sql).toMatch(/ORDER BY \(question\.item ->> 'sortOrder'\)::integer/);
    expect(sql).toMatch(/ORDER BY \(answer\.item ->> 'sortOrder'\)::integer/);
    expect(sql).toMatch(/ruleKind' = 'CONDITIONAL_BRANCH'/);
    expect(sql).toMatch(/branchQuestionIds[\s\S]*signalTag/);
  });

  it("returns only the requested published engine configuration", () => {
    expect(sql).toContain("public_get_pinned_engine_config");
    expect(sql).toMatch(
      /public_get_pinned_engine_config[\s\S]*version\.id = p_config_version_id[\s\S]*version\.status = 'PUBLISHED'/,
    );
    for (const key of [
      "questions",
      "answers",
      "mappings",
      "modules",
      "modifiers",
      "recommendations",
      "moduleRecommendations",
      "opportunities",
      "entrepreneurStages",
      "entrepreneurChallenges",
      "engineRules",
    ]) {
      expect(sql).toContain(`version.snapshot -> '${key}'`);
    }
    const engineFunction = sql.slice(sql.indexOf("public_get_pinned_engine_config"));
    expect(engineFunction).not.toMatch(/snapshot -> '(source|documentationExamples|editingInstructions)'/);
    expect(engineFunction).not.toMatch(/latest|published_at\s+desc/i);
  });

  it("is read-only and executable only by service_role", () => {
    expect(sql).toMatch(/LANGUAGE sql[\s\S]*STABLE[\s\S]*SECURITY DEFINER/);
    expect(sql).not.toMatch(/\b(insert|update|delete|truncate|drop)\b/i);
    expect(sql).toMatch(/REVOKE EXECUTE[\s\S]*PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE[\s\S]*TO service_role/);
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.public_get_pinned_engine_config\(uuid\)[\s\S]*TO service_role/,
    );
  });
});
