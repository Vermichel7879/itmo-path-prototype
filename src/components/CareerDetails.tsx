import type { Career, Discipline, Skill } from "../types/program";

interface Props {
  career: Career;
  skills: Skill[];
  disciplines: Discipline[];
}

export function CareerDetails({ career, skills, disciplines }: Props) {
  return (
    <details className="career-details">
      <summary>Подробнее</summary>
      <h3>{career.title}</h3>
      <p>{career.short_description}</p>
      <h4>Что ты будешь делать</h4>
      <ul>{career.what_you_do.map((item) => <li key={item}>{item}</li>)}</ul>
      <h4>Ключевые навыки</h4>
      <ul>{skills.map((skill) => <li key={skill.skill_id}>{skill.title}</li>)}</ul>
      <h4>Специализации</h4>
      <ul>{career.specializations.map((item) => <li key={item}>{item}</li>)}</ul>
      <h4>Почему эта программа</h4>
      <p>{career.why_this_program}</p>
      <h4>Примеры стартовых позиций</h4>
      <ul>{career.entry_level_examples.map((item) => <li key={item}>{item}</li>)}</ul>
      {disciplines.length ? (
        <>
          <h4>Связанные дисциплины</h4>
          <ul>{disciplines.map((item) => <li key={item.discipline_id}>{item.name}</li>)}</ul>
        </>
      ) : null}
    </details>
  );
}
