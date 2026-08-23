export type QuestionId =
  | "Q1"
  | "Q2"
  | "Q3"
  | "Q4"
  | "Q5"
  | "Q6"
  | "Q7"
  | "Q8"
  | "Q9"
  | "Q10";

export type ModuleId =
  | "M01"
  | "M02"
  | "M03"
  | "M04"
  | "M05"
  | "M06"
  | "M07"
  | "M08"
  | "M09"
  | "M10"
  | "M11";

export type AnswerId = `${QuestionId}_A${number}`;

export interface AnswerOption {
  id: AnswerId;
  text: string;
  weights?: Partial<Record<ModuleId, number>>;
  tags?: string[];
}

export interface CareerQuestion {
  id: QuestionId;
  block: string;
  title: string;
  instruction: string;
  type: "single" | "multi";
  minSelect: number;
  maxSelect: number;
  required: boolean;
  entrepreneurshipOnly?: boolean;
  answers: AnswerOption[];
}

export interface CareerModule {
  id: ModuleId;
  name: string;
  goal: string;
  steps: [string, string, string];
  checkpoint: string;
  recommendationIds: string[];
}

export type RecommendationType =
  | "Сервис ЦКО"
  | "Мероприятие"
  | "Инструмент"
  | "Клуб"
  | "Факультетская активность";

export interface CareerRecommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  detail: string;
  preferenceTags: string[];
}

export interface PaceConfig {
  label: string;
  description: string;
}

export interface EntrepreneurStage {
  answerId: AnswerId;
  focus: string;
  steps: [string, string, string];
  checkpoint: string;
}

export interface EntrepreneurChallenge {
  answerId: AnswerId;
  guidance: string;
  recommendationId: string;
}

export interface CareerConfig {
  questions: CareerQuestion[];
  modules: Record<ModuleId, CareerModule>;
  recommendations: Record<string, CareerRecommendation>;
  stageSummaries: Partial<Record<AnswerId, string>>;
  pace: Partial<Record<AnswerId, PaceConfig>>;
  entrepreneurStages: Partial<Record<AnswerId, EntrepreneurStage>>;
  entrepreneurChallenges: Partial<Record<AnswerId, EntrepreneurChallenge>>;
}

export type CareerAnswers = Partial<Record<QuestionId, AnswerId[]>>;

export interface TrajectoryResult {
  primary: CareerModule;
  supports: CareerModule[];
  pointA: string;
  priorities: string[];
  steps: [string, string, string];
  checkpoint: string;
  pace: PaceConfig;
  recommendations: CareerRecommendation[];
  entrepreneurSignal: boolean;
}
