import type { JourneyAnswers, JourneyOption, JourneyStep, ProgramJourney } from "../types/journey";

export function createStepIndex(journey: ProgramJourney): Map<string, JourneyStep> {
  return new Map(journey.steps.map((step) => [step.step_id, step]));
}

export function isStepVisible(step: JourneyStep, answers: JourneyAnswers): boolean {
  return !step.show_if || answers[step.show_if.step_id] === step.show_if.option_id;
}

export function resolveNextStepId(
  journey: ProgramJourney,
  currentStep: JourneyStep,
  answers: JourneyAnswers,
): string | null {
  const selected = currentStep.options?.find((option) => option.option_id === answers[currentStep.step_id]);
  let nextId = selected?.next_step_id ?? currentStep.next_step_id ?? null;
  const index = createStepIndex(journey);
  const seen = new Set<string>();
  while (nextId) {
    if (seen.has(nextId)) throw new Error(`Cycle while resolving journey at ${nextId}`);
    seen.add(nextId);
    const next = index.get(nextId);
    if (!next) throw new Error(`Unknown journey step ${nextId}`);
    if (isStepVisible(next, answers)) return nextId;
    nextId = next.next_step_id ?? null;
  }
  return null;
}

export function selectedOption(step: JourneyStep, answers: JourneyAnswers): JourneyOption | null {
  return step.options?.find((option) => option.option_id === answers[step.step_id]) ?? null;
}

export function journeyProgress(
  journey: ProgramJourney,
  answers: JourneyAnswers,
  visitedSteps: number,
): { current: number; total: number } {
  const unconditionalCount = journey.steps.filter((step) => !step.show_if).length;
  const conditionalGroups = new Map<string, Map<string, number>>();
  for (const step of journey.steps) {
    if (!step.show_if) continue;
    const options = conditionalGroups.get(step.show_if.step_id) ?? new Map<string, number>();
    options.set(step.show_if.option_id, (options.get(step.show_if.option_id) ?? 0) + 1);
    conditionalGroups.set(step.show_if.step_id, options);
  }
  let conditionalCount = 0;
  for (const [conditionStepId, options] of conditionalGroups) {
    const answer = answers[conditionStepId];
    conditionalCount += answer
      ? options.get(answer) ?? 0
      : Math.max(0, ...options.values());
  }
  const total = unconditionalCount + conditionalCount;
  return {
    current: Math.min(visitedSteps + 1, total),
    total,
  };
}

export function validateJourneyRuntime(journey: ProgramJourney): string[] {
  const errors: string[] = [];
  const ids = new Set(journey.steps.map((step) => step.step_id));
  if (!ids.has(journey.start_step_id)) errors.push("Не найден начальный шаг сценария.");
  for (const step of journey.steps) {
    if (step.type !== "result" && (!step.next_step_id || !ids.has(step.next_step_id))) {
      errors.push(`Некорректный переход из шага ${step.step_id}.`);
    }
    if (step.show_if && !ids.has(step.show_if.step_id)) errors.push(`Некорректное условие шага ${step.step_id}.`);
  }
  return errors;
}
