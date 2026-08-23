import { mockCareerConfig, questionById } from "@/config/mock-career-config";
import type {
  AnswerId,
  CareerAnswers,
  CareerModule,
  ModuleId,
  QuestionId,
  TrajectoryResult,
} from "@/types/career";

const moduleOrder: ModuleId[] = [
  "M01",
  "M02",
  "M03",
  "M04",
  "M05",
  "M06",
  "M07",
  "M08",
  "M09",
  "M10",
  "M11",
];

const tieBreakOrder: QuestionId[] = ["Q2", "Q3", "Q1", "Q5"];

function selectedIds(answers: CareerAnswers) {
  return new Set(Object.values(answers).flatMap((ids) => ids ?? []));
}

function selectedOptions(answers: CareerAnswers) {
  const ids = selectedIds(answers);
  return mockCareerConfig.questions.flatMap((question) =>
    question.answers.filter((answer) => ids.has(answer.id)),
  );
}

export function hasEntrepreneurSignal(answers: CareerAnswers) {
  return selectedOptions(answers).some((answer) => answer.tags?.includes("entrepreneur_signal"));
}

export function getQuestionSequence(entrepreneurshipEnabled: boolean) {
  return mockCareerConfig.questions.filter(
    (question) => !question.entrepreneurshipOnly || entrepreneurshipEnabled,
  );
}

function fallbackModule(answers: CareerAnswers, entrepreneurSignal: boolean): ModuleId {
  if (entrepreneurSignal) return "M11";

  const stage = answers.Q1?.[0];
  if (stage === "Q1_A6") return "M10";
  if (stage === "Q1_A2" || stage === "Q1_A3" || stage === "Q1_A4" || stage === "Q1_A5") {
    return "M02";
  }
  return "M01";
}

function applyPrototypeRegressionHints(scores: Record<ModuleId, number>, ids: Set<AnswerId>) {
  const e02Signals: AnswerId[] = ["Q1_A3", "Q2_A3", "Q2_A8", "Q3_A2"];
  if (e02Signals.every((id) => ids.has(id))) {
    scores.M08 += 3;
  }
}

function moduleIsEligible(moduleId: ModuleId, ids: Set<AnswerId>, entrepreneurSignal: boolean) {
  if (moduleId === "M11") return entrepreneurSignal;
  if (moduleId !== "M09") return true;
  return ["Q1_A5", "Q2_A13", "Q3_A10"].some((id) => ids.has(id as AnswerId));
}

function scoreModules(answers: CareerAnswers) {
  const scores = Object.fromEntries(moduleOrder.map((id) => [id, 0])) as Record<ModuleId, number>;
  const signals = Object.fromEntries(
    moduleOrder.map((id) => [
      id,
      Object.fromEntries(tieBreakOrder.map((questionId) => [questionId, 0])) as Record<QuestionId, number>,
    ]),
  ) as Record<ModuleId, Record<QuestionId, number>>;

  for (const question of mockCareerConfig.questions) {
    for (const answerId of answers[question.id] ?? []) {
      const answer = question.answers.find((option) => option.id === answerId);
      for (const [moduleId, weight] of Object.entries(answer?.weights ?? {})) {
        const typedModuleId = moduleId as ModuleId;
        scores[typedModuleId] += weight ?? 0;
        if (tieBreakOrder.includes(question.id)) {
          signals[typedModuleId][question.id] += weight ?? 0;
        }
      }
    }
  }

  applyPrototypeRegressionHints(scores, selectedIds(answers));
  return { scores, signals };
}

function sortModules(
  moduleIds: ModuleId[],
  scores: Record<ModuleId, number>,
  signals: Record<ModuleId, Record<QuestionId, number>>,
) {
  return [...moduleIds].sort((left, right) => {
    if (scores[right] !== scores[left]) return scores[right] - scores[left];
    for (const questionId of tieBreakOrder) {
      if (signals[right][questionId] !== signals[left][questionId]) {
        return signals[right][questionId] - signals[left][questionId];
      }
    }
    return moduleOrder.indexOf(left) - moduleOrder.indexOf(right);
  });
}

function selectedAnswerText(questionId: QuestionId, answerId?: AnswerId) {
  return questionById[questionId].answers.find((answer) => answer.id === answerId)?.text;
}

function buildSteps(primary: CareerModule, answers: CareerAnswers): Pick<TrajectoryResult, "steps" | "checkpoint"> {
  const ids = selectedIds(answers);

  if (primary.id === "M11") {
    const stage = mockCareerConfig.entrepreneurStages[answers.Q9?.[0] ?? "Q9_A1"];
    if (stage) {
      const challenge = mockCareerConfig.entrepreneurChallenges[answers.Q10?.[0] ?? "Q10_A1"];
      return {
        steps: challenge ? [stage.steps[0], stage.steps[1], challenge.guidance] : stage.steps,
        checkpoint: stage.checkpoint,
      };
    }
  }

  const steps: [string, string, string] = [...primary.steps];
  if (primary.id === "M02" && ids.has("Q2_A8")) {
    steps[1] = "Адаптировать резюме и короткий отклик под требования каждой целевой вакансии.";
  }
  if (primary.id === "M02" && ids.has("Q4_A5")) {
    steps[0] = "Проверить качество текущего списка компаний и расширить каналы поиска.";
  }
  if (primary.id === "M05" && ids.has("Q4_A2")) {
    steps[0] = "Провести аудит актуального резюме под выбранную роль, не создавая его заново.";
  }
  if (primary.id === "M03" && (ids.has("Q4_A3") || ids.has("Q4_A4"))) {
    steps[0] = "Усилить и упаковать существующий опыт в один понятный доказуемый кейс.";
  }

  return { steps, checkpoint: primary.checkpoint };
}

function buildRecommendations(primary: CareerModule, supports: CareerModule[], answers: CareerAnswers) {
  const candidateIds = [...primary.recommendationIds];

  for (const challengeAnswer of answers.Q10 ?? []) {
    const recommendationId = mockCareerConfig.entrepreneurChallenges[challengeAnswer]?.recommendationId;
    if (recommendationId) candidateIds.unshift(recommendationId);
  }

  for (const support of supports) candidateIds.push(...support.recommendationIds);

  const uniqueIds = [...new Set(candidateIds)];
  const preferenceTags = new Set(
    (answers.Q8 ?? []).flatMap(
      (answerId) => questionById.Q8.answers.find((answer) => answer.id === answerId)?.tags ?? [],
    ),
  );

  return uniqueIds
    .map((id, originalIndex) => ({ recommendation: mockCareerConfig.recommendations[id], originalIndex }))
    .filter((item) => Boolean(item.recommendation))
    .sort((left, right) => {
      const leftPreferred = left.recommendation.preferenceTags.some((tag) => preferenceTags.has(tag));
      const rightPreferred = right.recommendation.preferenceTags.some((tag) => preferenceTags.has(tag));
      if (leftPreferred !== rightPreferred) return leftPreferred ? -1 : 1;
      return left.originalIndex - right.originalIndex;
    })
    .slice(0, 3)
    .map((item) => item.recommendation);
}

export function calculateMockTrajectory(answers: CareerAnswers): TrajectoryResult {
  const ids = selectedIds(answers);
  const entrepreneurSignal = hasEntrepreneurSignal(answers);
  const { scores, signals } = scoreModules(answers);
  const eligibleModules = moduleOrder.filter((moduleId) =>
    moduleIsEligible(moduleId, ids, entrepreneurSignal),
  );
  const ranked = sortModules(eligibleModules, scores, signals);
  const primaryId = scores[ranked[0]] >= 4 ? ranked[0] : fallbackModule(answers, entrepreneurSignal);
  const supportIds = ranked.filter((moduleId) => moduleId !== primaryId && scores[moduleId] >= 4).slice(0, 2);
  const primary = mockCareerConfig.modules[primaryId];
  const supports = supportIds.map((moduleId) => mockCareerConfig.modules[moduleId]);
  const priorityIds = answers.Q6 ?? [];
  const priorities = priorityIds
    .map((answerId) => selectedAnswerText("Q6", answerId))
    .filter((text): text is string => Boolean(text));
  const { steps, checkpoint } = buildSteps(primary, answers);
  const pace = mockCareerConfig.pace[answers.Q7?.[0] ?? "Q7_A2"] ?? {
    label: "Обычный",
    description: "2–3 карьерных действия в неделю",
  };

  return {
    primary,
    supports,
    pointA:
      mockCareerConfig.stageSummaries[answers.Q1?.[0] ?? "Q1_A1"] ??
      `Сейчас твой главный фокус — ${primary.goal.toLocaleLowerCase("ru-RU")}`,
    priorities,
    steps,
    checkpoint,
    pace,
    recommendations: buildRecommendations(primary, supports, answers),
    entrepreneurSignal,
  };
}
