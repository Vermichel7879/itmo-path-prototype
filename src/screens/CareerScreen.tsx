import { CareerCard } from "../components/CareerCard";
import type { ProgramDatabase } from "../types/program";
import { createIndices, resolveExisting } from "../game/selectors";

interface Props {
  program: ProgramDatabase;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function CareerScreen({ program, selectedId, onSelect }: Props) {
  const indices = createIndices(program);
  return (
    <section className="screen">
      <h1>Выбери карьерную траекторию</h1>
      <p>Одна траектория станет основой рекомендаций на следующих этапах.</p>
      <div className="card-grid">
        {program.careers.map((career) => {
          const route = indices.routeByCareerId.get(career.career_id);
          const skills = resolveExisting(career.key_skills, indices.skillById, "skill");
          const disciplines = route ? resolveExisting(route.core_disciplines, indices.disciplineById, "discipline").slice(0, 5) : [];
          return <CareerCard key={career.career_id} career={career} skills={skills} disciplines={disciplines} selected={selectedId === career.career_id} onSelect={() => onSelect(career.career_id)} />;
        })}
      </div>
    </section>
  );
}
