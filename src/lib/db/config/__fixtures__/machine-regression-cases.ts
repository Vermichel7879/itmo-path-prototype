export interface MachineRegressionFixture {
  stableId: `T${string}`;
  covers: string[];
  selectedAnswerIds: string[];
  expectedPrimaryModuleId: string;
  expectedSupportModuleIds: string[];
  expectedModifierIds?: string[];
  expectedPaceKey?: string;
  expectedEntrepreneurStageId?: string;
  expectedEntrepreneurChallengeIds?: string[];
  expectedIgnoredAnswerIds?: string[];
  mappingWeightOverrides?: Array<{
    answerId: string;
    moduleId: string;
    weight: number;
  }>;
  rankingScoresOverride?: Record<
    string,
    { total: number; Q2: number; Q3: number; Q1: number; Q5: number }
  >;
}

const fixture = (
  stableId: `T${string}`,
  covers: string[],
  selectedAnswerIds: string[],
  expectedPrimaryModuleId: string,
  expectedSupportModuleIds: string[] = [],
  extra: Omit<
    MachineRegressionFixture,
    | "stableId"
    | "covers"
    | "selectedAnswerIds"
    | "expectedPrimaryModuleId"
    | "expectedSupportModuleIds"
  > = {},
): MachineRegressionFixture => ({
  stableId,
  covers,
  selectedAnswerIds,
  expectedPrimaryModuleId,
  expectedSupportModuleIds,
  ...extra,
});

// Test-only deterministic inputs for the PHASE 3 engine. They are not
// production configuration and must never be loaded by public runtime code.
// Support expectations follow R04 + R05 literally: ranked eligible modules
// after primary, score >= supportThreshold, capped at maxSupportCount. Fixtures
// verify that business logic; they are not a separate source of business rules.
export const machineRegressionFixtures: MachineRegressionFixture[] = [
  fixture(
    "T01",
    ["normal-scoring", "support-threshold-4"],
    ["Q1_A3", "Q2_A3", "Q2_A8", "Q3_A2", "Q5_A1"],
    "M02",
    ["M05"],
    { expectedModifierIds: ["MOD06"] },
  ),
  fixture(
    "T02",
    ["q2-tie-break"],
    ["Q1_A1", "Q2_A1", "Q3_A2", "Q5_A1"],
    "M01",
    ["M02"],
  ),
  fixture(
    "T03",
    ["q3-tie-break"],
    ["Q1_A1", "Q2_A2", "Q2_A3", "Q3_A2", "Q5_A1", "Q5_A5"],
    "M02",
    ["M01"],
  ),
  fixture(
    "T04",
    ["q1-tie-break"],
    ["Q1_A1", "Q2_A3", "Q3_A1", "Q3_A3", "Q5_A3"],
    "M01",
    ["M03", "M02"],
  ),
  fixture(
    "T05",
    ["q5-tie-break"],
    ["Q5_A1", "Q5_A5"],
    "M01",
    ["M02"],
    {
      rankingScoresOverride: {
        M01: { total: 8, Q2: 3, Q3: 2, Q1: 1, Q5: 2 },
        M02: { total: 8, Q2: 3, Q3: 2, Q1: 1, Q5: 1 },
      },
    },
  ),
  fixture(
    "T06",
    ["module-sort-order-final-tie"],
    ["Q1_A1", "Q2_A3", "Q2_A5", "Q3_A2", "Q3_A4", "Q5_A3"],
    "M02",
    ["M04"],
  ),
  fixture(
    "T07",
    ["support-below-4-rejected", "max-2-supports"],
    ["Q2_A1"],
    "M01",
    ["M03", "M04"],
    {
      mappingWeightOverrides: [
        { answerId: "Q2_A1", moduleId: "M01", weight: 6 },
        { answerId: "Q2_A1", moduleId: "M03", weight: 5 },
        { answerId: "Q2_A1", moduleId: "M04", weight: 4 },
        { answerId: "Q2_A1", moduleId: "M05", weight: 4 },
        { answerId: "Q2_A1", moduleId: "M08", weight: 3 },
      ],
    },
  ),
  fixture(
    "T08",
    ["m09-guard"],
    ["Q2_A1"],
    "M01",
    [],
    {
      mappingWeightOverrides: [
        { answerId: "Q2_A1", moduleId: "M09", weight: 10 },
      ],
    },
  ),
  fixture(
    "T09",
    ["m11-guard", "entrepreneurship-branch-off"],
    ["Q2_A1"],
    "M01",
    [],
    {
      mappingWeightOverrides: [
        { answerId: "Q2_A1", moduleId: "M11", weight: 10 },
      ],
    },
  ),
  fixture("T10", ["fallback-m01"], ["Q1_A1"], "M01"),
  fixture("T11", ["fallback-m02"], ["Q1_A2"], "M02"),
  fixture(
    "T12",
    ["fallback-m10"],
    ["Q1_A6"],
    "M10",
    [],
    {
      mappingWeightOverrides: [
        { answerId: "Q1_A6", moduleId: "M10", weight: 3 },
      ],
    },
  ),
  fixture("T13", ["fallback-m11"], ["Q4_A6"], "M11"),
  fixture("T14", ["modifier-mod01"], ["Q1_A1", "Q4_A1"], "M01", [], {
    expectedModifierIds: ["MOD01"],
  }),
  fixture("T15", ["modifier-mod02"], ["Q2_A7", "Q4_A2"], "M05", [], {
    expectedModifierIds: ["MOD02"],
  }),
  fixture("T16", ["modifier-mod03"], ["Q2_A4", "Q4_A3"], "M03", [], {
    expectedModifierIds: ["MOD03"],
  }),
  fixture("T17", ["modifier-mod04"], ["Q2_A4", "Q4_A4"], "M03", [], {
    expectedModifierIds: ["MOD04"],
  }),
  fixture("T18", ["modifier-mod05"], ["Q2_A3", "Q4_A5"], "M02", [], {
    expectedModifierIds: ["MOD05"],
  }),
  fixture("T19", ["modifier-mod06"], ["Q2_A8"], "M05", [], {
    expectedModifierIds: ["MOD06"],
  }),
  fixture(
    "T20",
    ["q6-priorities", "q7-pace", "q8-materials"],
    ["Q1_A1", "Q6_A2", "Q6_A7", "Q7_A2", "Q8_A1"],
    "M01",
    [],
    { expectedModifierIds: ["MOD09", "MOD10"], expectedPaceKey: "pace_normal" },
  ),
  fixture("T21", ["q8-individual"], ["Q1_A1", "Q8_A2"], "M01"),
  fixture("T22", ["q8-events"], ["Q1_A1", "Q8_A3"], "M01"),
  fixture("T23", ["q8-practice"], ["Q1_A1", "Q8_A4"], "M01"),
  fixture("T24", ["q8-default-mix"], ["Q1_A1", "Q8_A5"], "M01"),
  fixture(
    "T25",
    ["entrepreneurship-branch-on", "q9-stage-interest"],
    ["Q4_A6", "Q9_A1", "Q10_A1"],
    "M11",
    [],
    { expectedEntrepreneurStageId: "ent_stage_interest" },
  ),
  fixture("T26", ["q9-stage-idea"], ["Q4_A6", "Q9_A2", "Q10_A2"], "M11", [], {
    expectedEntrepreneurStageId: "ent_stage_idea",
  }),
  fixture(
    "T27",
    ["q9-stage-validation", "two-q10-challenges"],
    ["Q4_A6", "Q9_A3", "Q10_A3", "Q10_A6"],
    "M11",
    [],
    {
      expectedEntrepreneurStageId: "ent_stage_validation",
      expectedEntrepreneurChallengeIds: ["ent_demand", "ent_sales"],
    },
  ),
  fixture("T28", ["q9-stage-users"], ["Q4_A7", "Q9_A4", "Q10_A7"], "M11", [], {
    expectedEntrepreneurStageId: "ent_stage_users",
  }),
  fixture("T29", ["q9-stage-revenue"], ["Q4_A7", "Q9_A5", "Q10_A8"], "M11", [], {
    expectedEntrepreneurStageId: "ent_stage_revenue",
  }),
  fixture(
    "T30",
    ["hidden-q9-q10-ignored"],
    ["Q1_A1", "Q9_A5", "Q10_A7"],
    "M01",
    [],
    { expectedIgnoredAnswerIds: ["Q9_A5", "Q10_A7"] },
  ),
  fixture(
    "T31",
    ["recommendation-dedupe"],
    ["Q1_A6", "Q2_A2", "Q3_A4", "Q5_A5"],
    "M01",
    ["M04", "M10"],
  ),
];
