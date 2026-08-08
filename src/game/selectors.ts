import type {
  Career,
  CareerAction,
  CareerCenterResource,
  CareerRoute,
  Discipline,
  ElectiveGroup,
  ProgramDatabase,
  Skill,
} from "../types/program";

export interface ProgramIndices {
  disciplineById: Map<string, Discipline>;
  skillById: Map<string, Skill>;
  careerById: Map<string, Career>;
  groupById: Map<string, ElectiveGroup>;
  actionById: Map<string, CareerAction>;
  resourceById: Map<string, CareerCenterResource>;
  routeByCareerId: Map<string, CareerRoute>;
}

export function createIndices(program: ProgramDatabase): ProgramIndices {
  return {
    disciplineById: new Map(program.disciplines.map((item) => [item.discipline_id, item])),
    skillById: new Map(program.skills.map((item) => [item.skill_id, item])),
    careerById: new Map(program.careers.map((item) => [item.career_id, item])),
    groupById: new Map(program.elective_groups.map((item) => [item.group_id, item])),
    actionById: new Map(program.career_actions.map((item) => [item.action_id, item])),
    resourceById: new Map(program.career_center.resources.map((item) => [item.resource_id, item])),
    routeByCareerId: new Map(program.career_routes.map((item) => [item.career_id, item])),
  };
}

export function resolveExisting<T>(ids: string[], index: Map<string, T>, kind: string): T[] {
  return ids.flatMap((id) => {
    const entity = index.get(id);
    if (!entity) {
      console.warn(`Missing ${kind} reference ${id}`);
      return [];
    }
    return [entity];
  });
}

export function mandatoryForYear(program: ProgramDatabase, year: number): Discipline[] {
  const indices = createIndices(program);
  const semesterIds = program.timeline
    .filter((item) => Math.ceil(item.semester / 2) === year)
    .flatMap((item) => item.mandatory_highlights);
  return resolveExisting([...new Set(semesterIds)], indices.disciplineById, "discipline").slice(0, 5);
}
