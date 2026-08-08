import { findChoice, year1Choices, year3Choices, year4Choices } from "../data/prototypeChoices";
import type { Career, CareerAction, CareerCenterResource, Discipline, ProgramDatabase, Skill } from "../types/program";
import { materializeElectiveDisciplines, selectMeaningfulElectiveGroup } from "./electiveResolver";
import type { GameState } from "./reducer";
import { createIndices, mandatoryForYear, resolveExisting } from "./selectors";

export interface FinalRouteYear {
  year: number;
  mandatory: Discipline[];
  highlights: Discipline[];
  decisions: string[];
}

export interface FinalRoute {
  programName: string;
  career: Career;
  skills: Skill[];
  years: FinalRouteYear[];
  actions: CareerAction[];
  resources: CareerCenterResource[];
  recommendations: string[];
  disclaimer: string;
}

export function deduplicateCareerCenterResources(
  ids: string[],
  resources: CareerCenterResource[],
  limit = 5,
): CareerCenterResource[] {
  const index = new Map(resources.map((resource) => [resource.resource_id, resource]));
  return [...new Set(ids)].flatMap((id) => (index.has(id) ? [index.get(id)!] : [])).slice(0, limit);
}

export function buildFinalRoute(program: ProgramDatabase, state: GameState): FinalRoute {
  const indices = createIndices(program);
  const career = state.selectedCareerId ? indices.careerById.get(state.selectedCareerId) : undefined;
  const route = state.selectedCareerId ? indices.routeByCareerId.get(state.selectedCareerId) : undefined;
  if (!career || !route) throw new Error("Не удалось собрать маршрут: карьера не выбрана");

  const electiveGroup = selectMeaningfulElectiveGroup(program, route, [3, 4]);
  const selectedElectives = electiveGroup && state.electiveSelection
    ? resolveExisting(
        materializeElectiveDisciplines(program, electiveGroup, state.electiveSelection),
        indices.disciplineById,
        "discipline",
      )
    : [];
  const year1 = findChoice(year1Choices, state.year1Action);
  const year3 = findChoice(year3Choices, state.year3Experience);
  const year4 = findChoice(year4Choices, state.year4Goal);
  const eventLabels = program.game_events.flatMap((event) => {
    const selected = event.options.find((option) => option.id === state.eventChoices[event.event_id]);
    return selected ? [`${event.title}: ${selected.title}`] : [];
  });

  const decisionByYear: Record<number, string[]> = {
    1: year1 ? [year1.title] : [],
    2: selectedElectives.length ? [`Учебный выбор: ${selectedElectives.map((item) => item.name).join(", ")}`] : [],
    3: [...eventLabels.slice(0, 1), ...(year3 ? [year3.title] : [])],
    4: [...eventLabels.slice(1), ...(year4 ? [year4.title] : [])],
  };

  const years = [1, 2, 3, 4].map((year) => ({
    year,
    mandatory: mandatoryForYear(program, year),
    highlights: resolveExisting(route.timeline_highlights[`year_${year}`] ?? [], indices.disciplineById, "discipline").slice(0, 4),
    decisions: decisionByYear[year],
  }));
  const actions = resolveExisting(
    [...new Set([...route.career_actions, ...state.addedCareerActions])],
    indices.actionById,
    "career action",
  ).filter((action) => action.career_ids.includes(career.career_id)).slice(0, 5);
  const resources = deduplicateCareerCenterResources(
    [...state.selectedCareerCenterResources, ...actions.flatMap((action) => action.career_center_resources)],
    program.career_center.resources,
  );
  const skills = resolveExisting(route.key_skills, indices.skillById, "skill").slice(0, 6);

  const recommendations = [
    selectedElectives.length
      ? `Обрати внимание на выбранный учебный блок: ${selectedElectives.slice(0, 2).map((item) => item.name).join(" и ")}.`
      : `Сверяй учебные решения с задачами траектории «${career.title}».`,
    year3 ? `Для следующего опыта ты выбрал вариант «${year3.title}» — добавь его в ближайший план действий.` : null,
    year4 && resources.length
      ? `Цель «${year4.title}» можно связать с ресурсом «${resources[0].title}».`
      : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 3);

  return {
    programName: program.program.program_name,
    career,
    skills,
    years,
    actions,
    resources,
    recommendations,
    disclaimer: program.disclaimer,
  };
}
