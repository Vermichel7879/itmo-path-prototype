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
  ranking: string[];
  guardedModules: string[];
  fallbackReason: string | null;
  appliedModifierIds: string[];
  recommendationRanking: string[];
  ignoredAnswerIds: string[];
  entrepreneurChallengeIds: string[];
  recommendationSelections: Array<{ id: string; sourceModuleId: string | null }>;
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
