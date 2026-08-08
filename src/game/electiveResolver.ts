import type { CareerRoute, ElectiveGroup, ProgramDatabase } from "../types/program";
import { createIndices } from "./selectors";

export interface ElectiveSelection {
  groupId: string;
  selectedGroupIds: string[];
  selectedDisciplineIds: string[];
}

function directChoiceCount(group: ElectiveGroup): number {
  return group.selection_mode === "choose_n_groups" ? group.child_group_ids.length : group.options.length;
}

function isUserChoice(group: ElectiveGroup): boolean {
  return group.selection_mode !== "all" && directChoiceCount(group) >= 2;
}

function descendantGroupIds(group: ElectiveGroup, groupById: Map<string, ElectiveGroup>): string[] {
  return group.child_group_ids.flatMap((id) => {
    const child = groupById.get(id);
    return child ? [id, ...descendantGroupIds(child, groupById)] : [];
  });
}

export function selectMeaningfulElectiveGroup(
  program: ProgramDatabase,
  careerRoute: CareerRoute,
  preferredSemesters: number[],
): ElectiveGroup | null {
  const { groupById } = createIndices(program);
  const recommendedGroups = new Set(careerRoute.recommended_electives.map((item) => item.group_id));

  const scored = program.elective_groups
    .filter(isUserChoice)
    .map((group) => {
      const descendants = descendantGroupIds(group, groupById);
      const directRecommendation = recommendedGroups.has(group.group_id);
      const containsRecommendation = descendants.some((id) => recommendedGroups.has(id));
      const preferred = group.semesters.some((semester) => preferredSemesters.includes(semester));
      const careerFit = Math.max(0, ...group.options.map((option) => option.career_fit[careerRoute.career_id] ?? 0));
      const distance = Math.min(...group.semesters.map((semester) => Math.min(...preferredSemesters.map((p) => Math.abs(p - semester)))));
      const score = (directRecommendation ? 100 : 0) + (containsRecommendation ? 30 : 0) + (preferred ? 50 : 0) + careerFit * 5 - distance;
      return { group, score };
    })
    .sort((a, b) => b.score - a.score || a.group.group_id.localeCompare(b.group.group_id));

  return scored[0]?.group ?? null;
}

function selectedDirectChildren(group: ElectiveGroup, selection: ElectiveSelection): string[] {
  return group.child_group_ids.filter((id) => selection.selectedGroupIds.includes(id));
}

export function validateElectiveSelection(
  program: ProgramDatabase,
  group: ElectiveGroup,
  selection: ElectiveSelection,
): boolean {
  const { groupById, disciplineById } = createIndices(program);

  const validateGroup = (current: ElectiveGroup): boolean => {
    if (current.selection_mode === "all") {
      return current.child_group_ids.every((id) => {
        const child = groupById.get(id);
        return child ? validateGroup(child) : false;
      });
    }
    if (current.selection_mode === "choose_n_disciplines") {
      const selected = current.options.filter((option) => selection.selectedDisciplineIds.includes(option.discipline_id));
      return selected.length === (current.required_count ?? 1);
    }
    if (current.selection_mode === "choose_credits") {
      const credits = current.options.reduce((sum, option) => {
        if (!selection.selectedDisciplineIds.includes(option.discipline_id)) return sum;
        return sum + (disciplineById.get(option.discipline_id)?.credits ?? 0);
      }, 0);
      return credits >= (current.required_credits ?? 0);
    }
    const children = selectedDirectChildren(current, selection);
    if (children.length !== (current.required_count ?? 1)) return false;
    return children.every((id) => {
      const child = groupById.get(id);
      return child ? validateGroup(child) : false;
    });
  };

  return selection.groupId === group.group_id && validateGroup(group);
}

export function materializeElectiveDisciplines(
  program: ProgramDatabase,
  group: ElectiveGroup,
  selection: ElectiveSelection,
): string[] {
  const { groupById } = createIndices(program);
  const collect = (current: ElectiveGroup): string[] => {
    const own = current.selection_mode === "all"
      ? current.options.map((option) => option.discipline_id)
      : current.options.filter((option) => selection.selectedDisciplineIds.includes(option.discipline_id)).map((option) => option.discipline_id);
    const childIds = current.selection_mode === "all" ? current.child_group_ids : selectedDirectChildren(current, selection);
    return [
      ...own,
      ...childIds.flatMap((id) => {
        const child = groupById.get(id);
        return child ? collect(child) : [];
      }),
    ];
  };
  return [...new Set(collect(group))];
}

export function selectionCredits(program: ProgramDatabase, group: ElectiveGroup, selection: ElectiveSelection): number {
  const { disciplineById } = createIndices(program);
  return materializeElectiveDisciplines(program, group, selection).reduce(
    (sum, id) => sum + (disciplineById.get(id)?.credits ?? 0),
    0,
  );
}
