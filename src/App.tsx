import { useEffect, useMemo, useReducer } from "react";
import { Timeline } from "./components/Timeline";
import { Navigation } from "./components/Navigation";
import { eventResourceMapping, year1Choices, year3Choices, year4Choices, type PrototypeChoice } from "./data/prototypeChoices";
import { getProgramById, programs } from "./data/programs";
import { validatePrograms } from "./data/validate";
import { selectMeaningfulElectiveGroup, validateElectiveSelection, type ElectiveSelection } from "./game/electiveResolver";
import { currentSemester, gameReducer, gameSteps, stepNumber } from "./game/reducer";
import { buildFinalRoute } from "./game/routeBuilder";
import { createIndices, mandatoryForYear, resolveExisting } from "./game/selectors";
import { clearState, loadState, saveState } from "./game/storage";
import { CareerScreen } from "./screens/CareerScreen";
import { ChoiceScreen } from "./screens/ChoiceScreen";
import { ElectiveScreen } from "./screens/ElectiveScreen";
import { EventScreen } from "./screens/EventScreen";
import { ProgramScreen } from "./screens/ProgramScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { RouteIntroScreen } from "./screens/RouteIntroScreen";
import { StartScreen } from "./screens/StartScreen";

validatePrograms(programs.map((entry) => entry.database));

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, loadState);
  useEffect(() => saveState(state), [state]);

  const program = getProgramById(state.selectedProgramId);
  const indices = useMemo(() => program ? createIndices(program) : null, [program]);
  const career = state.selectedCareerId && indices ? indices.careerById.get(state.selectedCareerId) ?? null : null;
  const careerRoute = state.selectedCareerId && indices ? indices.routeByCareerId.get(state.selectedCareerId) ?? null : null;
  const electiveGroup = useMemo(
    () => program && careerRoute ? selectMeaningfulElectiveGroup(program, careerRoute, [3, 4]) : null,
    [program, careerRoute],
  );
  const debug = new URLSearchParams(window.location.search).get("debug") === "1";
  const semester = currentSemester(state.currentStep);

  const resourcesFor = (scope: string) => {
    if (!indices) return [];
    return resolveExisting(state.resourceSelections[scope] ?? [], indices.resourceById, "resource");
  };

  const setChoice = (scope: "year1" | "year3" | "year4", choice: PrototypeChoice) => {
    const resourceIds = choice.resourceIds.filter((id) => indices?.resourceById.has(id));
    if (scope === "year1") dispatch({ type: "SET_YEAR1", value: choice.id, resourceIds });
    if (scope === "year3") dispatch({ type: "SET_YEAR3", value: choice.id, resourceIds });
    if (scope === "year4") dispatch({ type: "SET_YEAR4", value: choice.id, resourceIds });
  };

  const setEvent = (eventIndex: number, choiceId: string) => {
    const event = program?.game_events[eventIndex];
    if (!event || !indices) return;
    const fallback = eventIndex === 1 ? ["career_consultation", "career_center_telegram"] : [];
    const resourceIds = (eventResourceMapping[event.event_id]?.[choiceId] ?? fallback).filter((id) => indices.resourceById.has(id));
    dispatch({ type: "SET_EVENT", eventId: event.event_id, value: choiceId, resourceIds });
  };

  const reset = () => {
    if (state.currentStep !== "start" && !window.confirm("Начать заново и удалить текущие выборы?")) return;
    clearState();
    dispatch({ type: "RESET" });
  };

  const canContinue = (() => {
    switch (state.currentStep) {
      case "program": return Boolean(state.selectedProgramId);
      case "career": return Boolean(state.selectedCareerId);
      case "year1_action": return Boolean(state.year1Action);
      case "elective": return !electiveGroup || Boolean(program && state.electiveSelection && validateElectiveSelection(program, electiveGroup, state.electiveSelection));
      case "event1": return Boolean(program?.game_events[0] && state.eventChoices[program.game_events[0].event_id]);
      case "year3_experience": return Boolean(state.year3Experience);
      case "event2": return Boolean(program?.game_events[1] && state.eventChoices[program.game_events[1].event_id]);
      case "year4_goal": return Boolean(state.year4Goal);
      default: return true;
    }
  })();

  const goNext = () => dispatch({ type: "NEXT", skipElective: state.currentStep === "year1_action" && !electiveGroup });
  const goBack = () => dispatch({ type: "BACK", skipElective: state.currentStep === "event1" && !electiveGroup });
  const setElective = (selection: ElectiveSelection) => dispatch({ type: "SET_ELECTIVE", selection });

  let content: React.ReactNode;
  if (state.currentStep === "start") {
    content = <StartScreen onStart={() => dispatch({ type: "NEXT" })} />;
  } else if (state.currentStep === "program") {
    content = <ProgramScreen programs={programs} selectedId={state.selectedProgramId} onSelect={(programId) => dispatch({ type: "SELECT_PROGRAM", programId })} />;
  } else if (!program || !indices) {
    content = <section className="screen error"><h1>Не удалось загрузить данные программы.</h1><p>Начни прохождение заново и выбери программу ещё раз.</p></section>;
  } else if (state.currentStep === "career") {
    content = <CareerScreen program={program} selectedId={state.selectedCareerId} onSelect={(careerId) => dispatch({ type: "SELECT_CAREER", careerId })} />;
  } else if (!career || !careerRoute) {
    content = <section className="screen error"><h1>Не удалось загрузить карьерный маршрут.</h1><p>Вернись назад и выбери карьерную траекторию.</p></section>;
  } else {
    const year3Descriptions: Record<string, string> = {
      company_project: `Проверить в команде задачу: ${career.what_you_do[0] ?? career.short_description}`,
      internship: `Увидеть рабочий контекст роли «${career.title}».`,
      research: `Глубже разобрать задачи и навыки траектории «${career.title}».`,
      own_project: `Самостоятельно попробовать задачи траектории «${career.title}» и сохранить результат.`,
    };
    switch (state.currentStep) {
      case "route_intro": content = <RouteIntroScreen program={program} />; break;
      case "year1_action": content = <ChoiceScreen title="С чего ты хочешь начать знакомство с профессией?" mandatory={mandatoryForYear(program, 1)} choices={year1Choices} selected={state.year1Action} resources={resourcesFor("year1")} onSelect={(choice) => setChoice("year1", choice)} />; break;
      case "elective": content = <ElectiveScreen program={program} group={electiveGroup} route={careerRoute} careerId={career.career_id} mandatory={mandatoryForYear(program, 2)} selection={state.electiveSelection} onChange={setElective} />; break;
      case "event1": {
        const event = program.game_events[0];
        content = event ? <EventScreen event={event} selected={state.eventChoices[event.event_id] ?? null} resources={resourcesFor(`event:${event.event_id}`)} onSelect={(id) => setEvent(0, id)} /> : <section className="screen error"><h1>Событие не найдено.</h1></section>;
        break;
      }
      case "year3_experience": content = <ChoiceScreen title="Какой профессиональный опыт тебе сейчас интереснее?" mandatory={mandatoryForYear(program, 3)} choices={year3Choices} selected={state.year3Experience} descriptions={year3Descriptions} resources={resourcesFor("year3")} onSelect={(choice) => setChoice("year3", choice)} />; break;
      case "event2": {
        const event = program.game_events[1];
        content = event ? <EventScreen event={event} selected={state.eventChoices[event.event_id] ?? null} resources={resourcesFor(`event:${event.event_id}`)} onSelect={(id) => setEvent(1, id)} /> : <section className="screen error"><h1>Событие не найдено.</h1></section>;
        break;
      }
      case "year4_goal": content = <ChoiceScreen title="С каким результатом ты хотел бы закончить обучение?" mandatory={mandatoryForYear(program, 4)} choices={year4Choices} selected={state.year4Goal} resources={resourcesFor("year4")} onSelect={(choice) => setChoice("year4", choice)} />; break;
      case "result": {
        try { content = <ResultScreen route={buildFinalRoute(program, state)} routeNumber={state.routeNumber} />; }
        catch (error) { console.error(error); content = <section className="screen error"><h1>Не удалось сформировать маршрут.</h1></section>; }
        break;
      }
      default: content = <section className="screen error"><h1>Неизвестный шаг игры.</h1></section>;
    }
  }

  const showTimeline = program && gameSteps.indexOf(state.currentStep) >= gameSteps.indexOf("route_intro") && state.currentStep !== "result";
  const isResult = state.currentStep === "result";
  return (
    <main>
      <header className="app-header">
        <div>
          <strong>Собери свой путь в ИТМО</strong>
          {state.currentStep !== "start" ? <small>Шаг {stepNumber(state.currentStep)} из {gameSteps.length - 1}{semester ? ` · ${Math.ceil(semester / 2)} курс` : ""}</small> : null}
        </div>
        <button type="button" className="link-button" onClick={reset}>Начать заново</button>
      </header>
      {showTimeline ? <Timeline timeline={program.timeline} currentSemester={semester} /> : null}
      {content}
      {state.currentStep !== "start" ? (
        isResult
          ? <nav className="navigation"><button type="button" className="secondary" onClick={goBack}>Назад</button></nav>
          : <Navigation onBack={goBack} onContinue={goNext} canContinue={canContinue} continueLabel={state.currentStep === "route_intro" ? "Начать путь" : state.currentStep === "year4_goal" ? "Собрать маршрут" : "Продолжить"} />
      ) : null}
      {debug ? <details className="debug" open><summary>Debug state</summary><pre>{JSON.stringify({ program: state.selectedProgramId, career: state.selectedCareerId, currentStep: state.currentStep, currentSemester: semester, selectedElective: state.electiveSelection, year1Choice: state.year1Action, year3Choice: state.year3Experience, year4Choice: state.year4Goal, eventChoices: state.eventChoices, selectedResources: state.selectedCareerCenterResources }, null, 2)}</pre></details> : null}
    </main>
  );
}
