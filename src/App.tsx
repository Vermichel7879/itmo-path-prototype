import { useMemo, useState } from "react";
import { Timeline } from "./components/Timeline";
import { JourneyStepView } from "./components/JourneyStepView";
import { Navigation } from "./components/Navigation";
import { getJourneyForProgram } from "./data/journeys";
import { getProgramById, programs } from "./data/programs";
import { validatePrograms } from "./data/validate";
import { createStepIndex, journeyProgress, resolveNextStepId, validateJourneyRuntime } from "./game/journeyEngine";
import { ProgramScreen } from "./screens/ProgramScreen";
import { StartScreen } from "./screens/StartScreen";
import type { JourneyAnswers } from "./types/journey";

type AppPage = "start" | "program" | "journey";

validatePrograms(programs.map((entry) => entry.database));

export default function App() {
  const [page, setPage] = useState<AppPage>("start");
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<JourneyAnswers>({});
  const [history, setHistory] = useState<string[]>([]);

  const program = getProgramById(selectedProgramId);
  const journey = getJourneyForProgram(program?.program.program_name ?? null);
  const stepIndex = useMemo(() => journey ? createStepIndex(journey) : new Map(), [journey]);
  const step = currentStepId ? stepIndex.get(currentStepId) ?? null : null;
  const journeyErrors = journey ? validateJourneyRuntime(journey) : [];

  const reset = () => {
    if (page !== "start" && !window.confirm("Начать заново и удалить текущие ответы?")) return;
    setPage("start");
    setSelectedProgramId(null);
    setCurrentStepId(null);
    setAnswers({});
    setHistory([]);
  };

  const selectProgram = (programId: string) => {
    setSelectedProgramId(programId);
    setCurrentStepId(null);
    setAnswers({});
    setHistory([]);
  };

  const startJourney = () => {
    if (!journey) return;
    setCurrentStepId(journey.start_step_id);
    setPage("journey");
  };

  const answerStep = (stepId: string, value: string) => {
    const changedIndex = journey?.steps.findIndex((item) => item.step_id === stepId) ?? -1;
    setAnswers((current) => {
      const next: JourneyAnswers = {};
      if (journey && changedIndex >= 0) {
        for (const [id, answer] of Object.entries(current)) {
          const answerIndex = journey.steps.findIndex((item) => item.step_id === id);
          if (answerIndex <= changedIndex) next[id] = answer;
        }
      } else Object.assign(next, current);
      next[stepId] = value;
      return next;
    });
  };

  const goNext = () => {
    if (page === "program") return startJourney();
    if (!journey || !step) return;
    const nextId = resolveNextStepId(journey, step, answers);
    if (!nextId) return;
    setHistory((current) => [...current, step.step_id]);
    setCurrentStepId(nextId);
  };

  const goBack = () => {
    if (page === "program") return setPage("start");
    if (!history.length) {
      setPage("program");
      setCurrentStepId(null);
      return;
    }
    const previous = history.at(-1)!;
    setHistory((current) => current.slice(0, -1));
    setCurrentStepId(previous);
  };

  const choiceRequired = Boolean(step && (step.type === "career_choice" || step.options?.length));
  const canContinue = page === "program"
    ? Boolean(selectedProgramId && journey)
    : Boolean(step && step.type !== "result" && (!choiceRequired || answers[step.step_id]));
  const progress = journey && step ? journeyProgress(journey, answers, history.length) : null;

  let content: React.ReactNode;
  if (page === "start") {
    content = <StartScreen onStart={() => setPage("program")} />;
  } else if (page === "program") {
    content = (
      <>
        <ProgramScreen programs={programs} selectedId={selectedProgramId} onSelect={selectProgram} />
        {selectedProgramId && !journey ? <p className="info-box">Для этой программы новый сценарий пока не подготовлен.</p> : null}
      </>
    );
  } else if (!program || !journey || !step || journeyErrors.length) {
    content = <section className="screen error"><h1>Не удалось загрузить сценарий</h1><ul>{journeyErrors.map((error) => <li key={error}>{error}</li>)}</ul></section>;
  } else {
    content = <JourneyStepView program={program} journey={journey} step={step} answers={answers} onAnswer={answerStep} />;
  }

  return (
    <main>
      <header className="app-header">
        <div>
          <strong>Собери свой путь в ИТМО</strong>
          {progress && step ? <small>Шаг {progress.current} из {progress.total}{step.semester ? ` · ${step.semester} семестр` : ""}</small> : null}
        </div>
        {page !== "start" ? <button type="button" className="link-button" onClick={reset}>Начать заново</button> : null}
      </header>
      {page === "journey" && program && step?.semester ? <Timeline timeline={program.timeline} currentSemester={step.semester} /> : null}
      {content}
      {page === "journey" && step?.type === "result" ? (
        <nav className="navigation" aria-label="Навигация по сценарию">
          <button type="button" className="secondary" onClick={goBack}>Назад</button>
        </nav>
      ) : page !== "start" ? (
        <Navigation
          onBack={goBack}
          onContinue={goNext}
          canContinue={canContinue}
          continueLabel={page === "program" ? "Начать путь" : "Продолжить"}
        />
      ) : null}
    </main>
  );
}
