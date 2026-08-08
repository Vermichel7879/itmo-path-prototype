import { ElectiveChoice } from "../components/ElectiveChoice";
import type { CareerRoute, Discipline, ElectiveGroup, ProgramDatabase } from "../types/program";
import type { ElectiveSelection } from "../game/electiveResolver";

interface Props {
  program: ProgramDatabase;
  group: ElectiveGroup | null;
  route: CareerRoute;
  careerId: string;
  mandatory: Discipline[];
  selection: ElectiveSelection | null;
  onChange: (selection: ElectiveSelection) => void;
}

export function ElectiveScreen({ program, group, route, careerId, mandatory, selection, onChange }: Props) {
  if (!group) {
    return <section className="screen"><h1>Ключевой учебный выбор</h1><p>В данных программы нет содержательного выборного блока для этого этапа. Экран будет пропущен.</p></section>;
  }
  const value = selection?.groupId === group.group_id ? selection : { groupId: group.group_id, selectedGroupIds: [], selectedDisciplineIds: [] };
  const isSecondYear = group.semesters.some((semester) => semester === 3 || semester === 4);
  return (
    <section className="screen">
      <h1>{isSecondYear ? "Выбор второго курса" : "Ключевой учебный выбор"}</h1>
      {mandatory.length ? <div className="mandatory-box"><h2>Обязательная основа этого года</h2><ul>{mandatory.map((item) => <li key={item.discipline_id}>{item.name}</li>)}</ul></div> : null}
      <p>Рекомендация учитывает выбранную профессию, но не ограничивает твой выбор.</p>
      <ElectiveChoice program={program} group={group} careerId={careerId} careerRoute={route} selection={value} onChange={onChange} />
    </section>
  );
}
