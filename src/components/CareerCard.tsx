import type { Career, Discipline, Skill } from "../types/program";
import { CareerDetails } from "./CareerDetails";

interface Props {
  career: Career;
  skills: Skill[];
  disciplines: Discipline[];
  selected: boolean;
  onSelect: () => void;
}

export function CareerCard({ career, skills, disciplines, selected, onSelect }: Props) {
  return (
    <article className={selected ? "card selected" : "card"}>
      <h3>{career.title}</h3>
      <p>{career.short_description}</p>
      <p><strong>Ключевые навыки:</strong> {skills.slice(0, 3).map((skill) => skill.title).join(", ")}</p>
      <CareerDetails career={career} skills={skills} disciplines={disciplines} />
      <button type="button" className={selected ? "secondary" : ""} onClick={onSelect}>
        {selected ? "Выбрано" : "Выбрать"}
      </button>
    </article>
  );
}
