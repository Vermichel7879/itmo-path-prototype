import type { CareerImport } from "../db/import/import-model";

export type PublishedCareerConfig = CareerImport;

export interface PublicTrajectoryModule {
  id: string;
  name: string;
  goal: string;
  steps: [string, string, string];
  checkpoint: string;
}

export interface PublicTrajectoryRecommendation {
  id: string;
  type: string;
  title: string;
  description: string;
  url: string | null;
}

export interface TrajectoryPace {
  key: string;
  text: string;
  actionsPerWeekMin: number | null;
  actionsPerWeekMax: number | null;
  parallelExperimentAllowed: boolean;
}

export interface TrajectoryResult {
  configVersionId: string;
  primaryModule: PublicTrajectoryModule;
  supportModules: PublicTrajectoryModule[];
  currentPoint: string;
  priorities: string[];
  steps: [string, string, string];
  adjustments: string[];
  pace: TrajectoryPace | null;
  recommendations: PublicTrajectoryRecommendation[];
  checkpoint: string;
  disclaimer: string;
  entrepreneurship: {
    active: boolean;
    stage: { id: string; focus: string } | null;
    challengeAdjustments: string[];
  };
}

export interface TrajectoryDebug {
  scores: Record<string, number>;
  questionSubtotals: Record<string, Record<string, number>>;
  scoreContributions: Array<{
    moduleId: string;
    questionId: string;
    answerId: string;
    weight: number;
  }>;
  ranking: string[];
  tieBreakQuestionIds: string[];
  guardedModules: string[];
  fallbackReason: string | null;
  fallbackConditionIndex: number | null;
  supportThreshold: number;
  maxSupportCount: number;
  primaryModuleId: string;
  supportModuleIds: string[];
  appliedModifierIds: string[];
  modifierApplications: Array<{
    id: string;
    targetModuleId: string;
    operationKind: string;
    triggerAnswerIds: string[];
  }>;
  selectedAnswerIds: string[];
  entrepreneurBranchActive: boolean;
  recommendationRanking: string[];
  ignoredAnswerIds: string[];
  entrepreneurChallengeIds: string[];
  recommendationSelections: Array<{
    id: string;
    recommendationId: string;
    sourceModuleId: string | null;
    source: "PRIMARY" | "SUPPORT" | "SPECIAL";
    linkPriority: number;
    challengeBoost: boolean;
    preferenceBoost: boolean;
    priorityTagBoost: boolean;
    opportunityResolved: boolean;
  }>;
}

export interface TrajectoryCalculation {
  result: TrajectoryResult;
  debug: TrajectoryDebug;
}

export interface EngineTestOverrides {
  rankingScores?: Record<
    string,
    { total: number; Q2: number; Q3: number; Q1: number; Q5: number }
  >;
}
