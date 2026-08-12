import { describe, expect, it } from "vitest";
import { getJourneyForProgram } from "../data/journeys";
import { getProgramById } from "../data/programs";
import { createStepIndex, journeyProgress, resolveNextStepId, validateJourneyRuntime } from "../game/journeyEngine";
import type { JourneyAnswers, ProgramJourney } from "../types/journey";

const programName = "Компьютерные технологии";
const program = getProgramById(programName)!;
const journey = getJourneyForProgram(programName)!;

function follow(journeyData: ProgramJourney, answers: JourneyAnswers): string[] {
  const index = createStepIndex(journeyData);
  const visited: string[] = [];
  let currentId: string | null = journeyData.start_step_id;
  while (currentId) {
    if (visited.includes(currentId)) throw new Error(`Cycle at ${currentId}`);
    visited.push(currentId);
    const step = index.get(currentId)!;
    if (step.type === "result") break;
    currentId = resolveNextStepId(journeyData, step, answers);
  }
  return visited;
}

describe("program journey runtime", () => {
  it("loads the journey for the matching program", () => {
    expect(journey.program.program_name).toBe(program.program.program_name);
    expect(validateJourneyRuntime(journey)).toEqual([]);
  });

  it("counts progress along the visible branch instead of JSON positions", () => {
    expect(journeyProgress(journey, {}, 1)).toEqual({ current: 2, total: 13 });
    expect(journeyProgress(journey, { profile_choice: "ai_and_programming_profile" }, 4))
      .toEqual({ current: 5, total: 13 });
  });

  it("follows the AI branch and skips the programming-only screens", () => {
    const visited = follow(journey, {
      career_context: "ml_engineer",
      profile_choice: "ai_and_programming_profile",
      semester_3_ai_choice: "ai_web_product",
      semester_5_ai_choice: "ai_learning_theory",
      career_center_case: "check_skill_readiness",
    });
    expect(visited).toContain("semester_3_ai_choice");
    expect(visited).toContain("semester_5_ai_choice");
    expect(visited).not.toContain("semester_3_programming_choice");
    expect(visited.at(-1)).toBe("result");
  });

  it("follows the programming branch and skips the AI-only screens", () => {
    const visited = follow(journey, {
      career_context: "software_engineer",
      profile_choice: "algorithms_and_programming_profile",
      semester_3_programming_choice: "programming_system_language",
      semester_5_programming_choice: "programming_industrial_code",
      career_center_case: "prepare_project_story",
    });
    expect(visited).toContain("semester_3_programming_choice");
    expect(visited).toContain("semester_5_programming_choice");
    expect(visited).not.toContain("semester_3_ai_choice");
    expect(visited.at(-1)).toBe("result");
  });
});
