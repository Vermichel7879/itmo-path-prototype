import type { CareerRoute, ElectiveGroup, ProgramDatabase } from "../types/program";
import { selectionCredits, type ElectiveSelection } from "../game/electiveResolver";
import { createIndices, resolveExisting } from "../game/selectors";

interface Props {
  program: ProgramDatabase;
  group: ElectiveGroup;
  careerId: string;
  careerRoute: CareerRoute;
  selection: ElectiveSelection;
  onChange: (selection: ElectiveSelection) => void;
}

const fitLabels: Record<number, string> = {
  3: "Особенно полезно для твоей траектории",
  2: "Хорошо связано с твоей траекторией",
  1: "Может быть полезно",
  0: "Без рекомендации",
};

export function ElectiveChoice({ program, group, careerId, careerRoute, selection, onChange }: Props) {
  const indices = createIndices(program);

  const subtree = (current: ElectiveGroup): { groups: string[]; disciplines: string[] } => {
    const childGroups = resolveExisting(current.child_group_ids, indices.groupById, "group");
    const nested = childGroups.map(subtree);
    return {
      groups: [current.group_id, ...nested.flatMap((item) => item.groups)],
      disciplines: [...current.options.map((item) => item.discipline_id), ...nested.flatMap((item) => item.disciplines)],
    };
  };

  const toggleDiscipline = (id: string) => {
    const selected = selection.selectedDisciplineIds.includes(id);
    onChange({
      ...selection,
      selectedDisciplineIds: selected
        ? selection.selectedDisciplineIds.filter((item) => item !== id)
        : [...selection.selectedDisciplineIds, id],
    });
  };

  const toggleGroup = (current: ElectiveGroup, child: ElectiveGroup) => {
    const selected = selection.selectedGroupIds.includes(child.group_id);
    if (selected) {
      const descendants = subtree(child);
      onChange({
        ...selection,
        selectedGroupIds: selection.selectedGroupIds.filter((id) => !descendants.groups.includes(id)),
        selectedDisciplineIds: selection.selectedDisciplineIds.filter((id) => !descendants.disciplines.includes(id)),
      });
      return;
    }
    const directSelected = current.child_group_ids.filter((id) => selection.selectedGroupIds.includes(id));
    const required = current.required_count ?? 1;
    if (directSelected.length >= required) return;
    onChange({ ...selection, selectedGroupIds: [...selection.selectedGroupIds, child.group_id] });
  };

  const renderDiscipline = (current: ElectiveGroup, disciplineId: string, readOnly = false) => {
    const discipline = indices.disciplineById.get(disciplineId);
    const option = current.options.find((item) => item.discipline_id === disciplineId);
    if (!discipline || !option) {
      console.warn(`Missing discipline reference ${disciplineId}`);
      return null;
    }
    const skills = resolveExisting(option.skills, indices.skillById, "skill");
    const fit = option.career_fit[careerId] ?? 0;
    const recommendation = careerRoute.recommended_electives.find((item) => item.discipline_id === disciplineId);
    return (
      <label className={selection.selectedDisciplineIds.includes(disciplineId) || readOnly ? "choice selected" : "choice"} key={disciplineId}>
        {readOnly ? <span aria-hidden="true">✓</span> : (
          <input
            type="checkbox"
            checked={selection.selectedDisciplineIds.includes(disciplineId)}
            onChange={() => toggleDiscipline(disciplineId)}
          />
        )}
        <span>
          <strong>{discipline.name}</strong>
          <small>{option.simple_description || discipline.simple_description || "Описание в базе пока не заполнено."}</small>
          {skills.length ? <small>Навыки: {skills.map((skill) => skill.title).join(", ")}</small> : null}
          <small className="fit-label">{fitLabels[fit] ?? fitLabels[0]}</small>
          {recommendation ? (
            <small className="recommendation">
              {recommendation.priority === "alternative" ? "Альтернативный вариант" : "Рекомендуем обратить внимание"}
            </small>
          ) : null}
          {current.selection_mode === "choose_credits" ? <small>{discipline.credits} з.е.</small> : null}
        </span>
      </label>
    );
  };

  const renderGroup = (current: ElectiveGroup, depth = 0): React.ReactNode => {
    const children = resolveExisting(current.child_group_ids, indices.groupById, "group");
    const selectedChildren = children.filter((child) => selection.selectedGroupIds.includes(child.group_id));
    return (
      <section className="elective-group" style={{ marginLeft: Math.min(depth, 2) * 12 }} key={current.group_id}>
        <h3>{current.name}</h3>
        {current.selection_mode === "choose_n_groups" ? (
          <p>Выбери {current.required_count ?? 1} {current.required_count === 1 ? "профиль" : "профиля"}.</p>
        ) : current.selection_mode === "choose_n_disciplines" ? (
          <p>Выбери {current.required_count ?? 1} дисциплин(у).</p>
        ) : current.selection_mode === "choose_credits" ? (
          <p>Нужно набрать {current.required_credits ?? 0} з.е. Сейчас: {selectionCredits(program, current, selection)} з.е.</p>
        ) : (
          <p>Все элементы этого блока входят автоматически.</p>
        )}

        {current.selection_mode === "choose_n_groups" ? (
          <div className="choice-list">
            {children.map((child) => (
              <div key={child.group_id}>
                <label className={selection.selectedGroupIds.includes(child.group_id) ? "choice selected" : "choice"}>
                  <input
                    type="checkbox"
                    checked={selection.selectedGroupIds.includes(child.group_id)}
                    onChange={() => toggleGroup(current, child)}
                  />
                  <span><strong>{child.name}</strong><small>Семестры: {child.semesters.join(", ")}</small></span>
                </label>
                {selection.selectedGroupIds.includes(child.group_id) ? renderGroup(child, depth + 1) : null}
              </div>
            ))}
          </div>
        ) : (
          <>
            {current.options.length ? (
              <div className="choice-list">
                {current.options.map((option) => renderDiscipline(current, option.discipline_id, current.selection_mode === "all"))}
              </div>
            ) : null}
            {children.map((child) => renderGroup(child, depth + 1))}
          </>
        )}
        {current.selection_mode === "choose_n_groups" && selectedChildren.length === 0 ? <p className="hint">Сначала выбери один из вложенных блоков.</p> : null}
      </section>
    );
  };

  return <>{renderGroup(group)}</>;
}
