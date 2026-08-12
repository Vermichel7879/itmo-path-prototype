import type { ProgramDatabase } from "../types/program";
import type { JourneyAnswers, JourneyOption, JourneyStep, ProgramJourney } from "../types/journey";
import { JourneyCareerChoice } from "./JourneyCareerChoice";
import { JourneyChoice } from "./JourneyChoice";
import { JourneyResult } from "./JourneyResult";
import { JourneySemesterSummary } from "./JourneySemesterSummary";

interface Props {
  program: ProgramDatabase;
  journey: ProgramJourney;
  step: JourneyStep;
  answers: JourneyAnswers;
  onAnswer: (stepId: string, value: string) => void;
}

export function JourneyStepView({ program, journey, step, answers, onAnswer }: Props) {
  if (step.type === "program_intro") return <section className="screen route-intro"><p className="eyebrow">Твой маршрут</p><h1>{step.title}</h1><p>{step.body}</p></section>;
  if (step.type === "career_choice") return <JourneyCareerChoice program={program} step={step} selected={answers[step.step_id] ?? null} onSelect={(id) => onAnswer(step.step_id, id)} />;
  if (step.type === "semester_summary") return <JourneySemesterSummary program={program} step={step} />;
  if (step.type === "interest_choice" || step.type === "practice_choice" || step.type === "career_center_situation") {
    return <JourneyChoice program={program} step={step} selected={answers[step.step_id] ?? null} selectedCareerId={answers.career_context ?? null} onSelect={(option: JourneyOption) => onAnswer(step.step_id, option.option_id)} />;
  }
  if (step.type === "result") return <JourneyResult program={program} journey={journey} answers={answers} />;
  return <section className="screen error"><h1>Неизвестный тип шага</h1></section>;
}
