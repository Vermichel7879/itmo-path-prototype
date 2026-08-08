import { describe, expect, it } from "vitest";
import { programs } from "../data/programs";
import type { ElectiveGroup, ProgramDatabase } from "../types/program";
import {
  selectMeaningfulElectiveGroup,
  validateElectiveSelection,
  type ElectiveSelection,
} from "../game/electiveResolver";
import { createInitialState, gameReducer } from "../game/reducer";
import { buildFinalRoute, deduplicateCareerCenterResources } from "../game/routeBuilder";
import { createIndices, resolveExisting } from "../game/selectors";

function makeValidSelection(program: ProgramDatabase, root: ElectiveGroup): ElectiveSelection {
  const indices = createIndices(program);
  const selection: ElectiveSelection = { groupId: root.group_id, selectedGroupIds: [], selectedDisciplineIds: [] };

  const fill = (group: ElectiveGroup) => {
    if (group.selection_mode === "choose_n_groups") {
      const count = group.required_count ?? 1;
      for (const childId of group.child_group_ids.slice(0, count)) {
        selection.selectedGroupIds.push(childId);
        const child = indices.groupById.get(childId);
        if (child) fill(child);
      }
    } else if (group.selection_mode === "choose_n_disciplines") {
      selection.selectedDisciplineIds.push(...group.options.slice(0, group.required_count ?? 1).map((option) => option.discipline_id));
    } else if (group.selection_mode === "choose_credits") {
      let credits = 0;
      for (const option of group.options) {
        if (credits >= (group.required_credits ?? 0)) break;
        selection.selectedDisciplineIds.push(option.discipline_id);
        credits += indices.disciplineById.get(option.discipline_id)?.credits ?? 0;
      }
    } else {
      for (const childId of group.child_group_ids) {
        const child = indices.groupById.get(childId);
        if (child) fill(child);
      }
    }
  };

  fill(root);
  return selection;
}

describe("data indices", () => {
  it("resolves id to entity and skips a missing reference", () => {
    const program = programs[0].database;
    const indices = createIndices(program);
    const discipline = program.disciplines[0];
    expect(resolveExisting([discipline.discipline_id], indices.disciplineById, "discipline")).toEqual([discipline]);
    expect(resolveExisting(["missing"], indices.disciplineById, "discipline")).toEqual([]);
  });
});

describe("meaningful elective resolver", () => {
  it.each(programs.map((entry) => [entry.database.program.program_name, entry.database] as const))(
    "selects a real user choice for %s",
    (_name, program) => {
      const route = program.career_routes[0];
      const group = selectMeaningfulElectiveGroup(program, route, [3, 4]);
      expect(group).not.toBeNull();
      expect(group?.selection_mode).not.toBe("all");
      expect((group?.options.length ?? 0) + (group?.child_group_ids.length ?? 0)).toBeGreaterThanOrEqual(2);
    },
  );

  it("validates nested choose_n_groups without flattening sibling branches", () => {
    const program = programs.map((item) => item.database).find((item) => item.elective_groups.some((group) => group.selection_mode === "choose_n_groups"))!;
    const group = program.elective_groups.find((item) => item.selection_mode === "choose_n_groups")!;
    const selection = makeValidSelection(program, group);
    expect(validateElectiveSelection(program, group, selection)).toBe(true);
    const directSelected = group.child_group_ids.filter((id) => selection.selectedGroupIds.includes(id));
    expect(directSelected).toHaveLength(group.required_count ?? 1);
  });

  it("requires the exact discipline count", () => {
    const program = programs.map((item) => item.database).find((item) => item.elective_groups.some((group) => group.selection_mode === "choose_n_disciplines"))!;
    const group = program.elective_groups.find((item) => item.selection_mode === "choose_n_disciplines")!;
    const valid = makeValidSelection(program, group);
    expect(validateElectiveSelection(program, group, valid)).toBe(true);
    expect(validateElectiveSelection(program, group, { ...valid, selectedDisciplineIds: [] })).toBe(false);
  });

  it("validates choose_credits by real discipline credits", () => {
    const program = programs.map((item) => item.database).find((item) => item.elective_groups.some((group) => group.selection_mode === "choose_credits"))!;
    const group = program.elective_groups.find((item) => item.selection_mode === "choose_credits")!;
    const valid = makeValidSelection(program, group);
    expect(validateElectiveSelection(program, group, valid)).toBe(true);
    expect(validateElectiveSelection(program, group, { ...valid, selectedDisciplineIds: [] })).toBe(false);
  });
});

describe("final route", () => {
  it("deduplicates Career Center resources", () => {
    const resources = programs[0].database.career_center.resources;
    const id = resources[0].resource_id;
    expect(deduplicateCareerCenterResources([id, id], resources)).toHaveLength(1);
  });

  it.each(programs.map((entry) => [entry.database.program.program_name, entry.database] as const))(
    "completes the full smoke flow for %s",
    (_name, program) => {
      const career = program.careers[0];
      const route = program.career_routes.find((item) => item.career_id === career.career_id)!;
      const group = selectMeaningfulElectiveGroup(program, route, [3, 4]);
      let state = createInitialState();
      state = gameReducer(state, { type: "SELECT_PROGRAM", programId: program.program.program_name });
      state = gameReducer(state, { type: "SELECT_CAREER", careerId: career.career_id });
      state = gameReducer(state, { type: "SET_YEAR1", value: "small_project", resourceIds: ["career_events"] });
      if (group) state = gameReducer(state, { type: "SET_ELECTIVE", selection: makeValidSelection(program, group) });
      for (const event of program.game_events.slice(0, 2)) {
        state = gameReducer(state, { type: "SET_EVENT", eventId: event.event_id, value: event.options[0].id, resourceIds: [] });
      }
      state = gameReducer(state, { type: "SET_YEAR3", value: "internship", resourceIds: ["internships", "resume"] });
      state = gameReducer(state, { type: "SET_YEAR4", value: "job_offer", resourceIds: ["vacancies", "interview"] });
      const finalRoute = buildFinalRoute(program, state);
      expect(finalRoute.programName).toBe(program.program.program_name);
      expect(finalRoute.career.career_id).toBe(career.career_id);
      expect(finalRoute.years).toHaveLength(4);
      expect(finalRoute.recommendations.length).toBeGreaterThanOrEqual(2);
    },
  );
});
