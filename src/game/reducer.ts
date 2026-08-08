import type { ElectiveSelection } from "./electiveResolver";

export type GameStep =
  | "start"
  | "program"
  | "career"
  | "route_intro"
  | "year1_action"
  | "elective"
  | "event1"
  | "year3_experience"
  | "event2"
  | "year4_goal"
  | "result";

export const gameSteps: GameStep[] = [
  "start",
  "program",
  "career",
  "route_intro",
  "year1_action",
  "elective",
  "event1",
  "year3_experience",
  "event2",
  "year4_goal",
  "result",
];

export interface GameState {
  schemaVersion: 1;
  selectedProgramId: string | null;
  selectedCareerId: string | null;
  year1Action: string | null;
  electiveSelection: ElectiveSelection | null;
  eventChoices: Record<string, string>;
  year3Experience: string | null;
  year4Goal: string | null;
  addedCareerActions: string[];
  selectedCareerCenterResources: string[];
  resourceSelections: Record<string, string[]>;
  currentStep: GameStep;
  routeNumber: string;
}

function createRouteNumber(): string {
  const value = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2);
  return value.replaceAll("-", "").slice(0, 6).toUpperCase();
}

export function createInitialState(): GameState {
  return {
    schemaVersion: 1,
    selectedProgramId: null,
    selectedCareerId: null,
    year1Action: null,
    electiveSelection: null,
    eventChoices: {},
    year3Experience: null,
    year4Goal: null,
    addedCareerActions: [],
    selectedCareerCenterResources: [],
    resourceSelections: {},
    currentStep: "start",
    routeNumber: createRouteNumber(),
  };
}

function withResourceScope(state: GameState, scope: string, resourceIds: string[]): GameState {
  const resourceSelections = { ...state.resourceSelections, [scope]: resourceIds };
  return {
    ...state,
    resourceSelections,
    selectedCareerCenterResources: [...new Set(Object.values(resourceSelections).flat())],
  };
}

export type GameAction =
  | { type: "NEXT"; skipElective?: boolean }
  | { type: "BACK"; skipElective?: boolean }
  | { type: "GO_TO"; step: GameStep }
  | { type: "SELECT_PROGRAM"; programId: string }
  | { type: "SELECT_CAREER"; careerId: string }
  | { type: "SET_YEAR1"; value: string; resourceIds: string[] }
  | { type: "SET_ELECTIVE"; selection: ElectiveSelection }
  | { type: "SET_EVENT"; eventId: string; value: string; resourceIds: string[] }
  | { type: "SET_YEAR3"; value: string; resourceIds: string[] }
  | { type: "SET_YEAR4"; value: string; resourceIds: string[] }
  | { type: "RESET" };

function adjacentStep(current: GameStep, direction: 1 | -1, skipElective = false): GameStep {
  let index = gameSteps.indexOf(current) + direction;
  if (skipElective && gameSteps[index] === "elective") index += direction;
  return gameSteps[Math.max(0, Math.min(gameSteps.length - 1, index))];
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "NEXT":
      return { ...state, currentStep: adjacentStep(state.currentStep, 1, action.skipElective) };
    case "BACK":
      return { ...state, currentStep: adjacentStep(state.currentStep, -1, action.skipElective) };
    case "GO_TO":
      return { ...state, currentStep: action.step };
    case "SELECT_PROGRAM":
      return {
        ...createInitialState(),
        selectedProgramId: action.programId,
        currentStep: state.currentStep,
        routeNumber: state.routeNumber,
      };
    case "SELECT_CAREER":
      return {
        ...state,
        selectedCareerId: action.careerId,
        electiveSelection: null,
        eventChoices: {},
        year1Action: null,
        year3Experience: null,
        year4Goal: null,
        resourceSelections: {},
        selectedCareerCenterResources: [],
      };
    case "SET_YEAR1":
      return withResourceScope({ ...state, year1Action: action.value }, "year1", action.resourceIds);
    case "SET_ELECTIVE":
      return { ...state, electiveSelection: action.selection };
    case "SET_EVENT":
      return withResourceScope(
        { ...state, eventChoices: { ...state.eventChoices, [action.eventId]: action.value } },
        `event:${action.eventId}`,
        action.resourceIds,
      );
    case "SET_YEAR3":
      return withResourceScope({ ...state, year3Experience: action.value }, "year3", action.resourceIds);
    case "SET_YEAR4":
      return withResourceScope({ ...state, year4Goal: action.value }, "year4", action.resourceIds);
    case "RESET":
      return createInitialState();
  }
}

export function stepNumber(step: GameStep): number {
  return Math.max(1, gameSteps.indexOf(step));
}

export function currentSemester(step: GameStep): number | null {
  const mapping: Partial<Record<GameStep, number>> = {
    year1_action: 2,
    elective: 4,
    event1: 6,
    year3_experience: 6,
    event2: 7,
    year4_goal: 8,
    result: 8,
  };
  return mapping[step] ?? null;
}
