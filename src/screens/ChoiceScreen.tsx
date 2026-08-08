import { CareerCenterResources } from "../components/CareerCenterResources";
import { ChoiceCards } from "../components/ChoiceCards";
import type { PrototypeChoice } from "../data/prototypeChoices";
import type { CareerCenterResource, Discipline } from "../types/program";

interface Props {
  title: string;
  lead?: string;
  mandatory: Discipline[];
  choices: PrototypeChoice[];
  selected: string | null;
  resources: CareerCenterResource[];
  descriptions?: Record<string, string>;
  onSelect: (choice: PrototypeChoice) => void;
}

export function ChoiceScreen({ title, lead, mandatory, choices, selected, resources, descriptions, onSelect }: Props) {
  return (
    <section className="screen">
      <h1>{title}</h1>
      {lead ? <p>{lead}</p> : null}
      {mandatory.length ? (
        <div className="mandatory-box">
          <h2>В этом году у тебя есть</h2>
          <ul>{mandatory.map((item) => <li key={item.discipline_id}>{item.name}</li>)}</ul>
        </div>
      ) : null}
      <ChoiceCards name={title} choices={choices} selected={selected} descriptions={descriptions} onSelect={onSelect} />
      {selected ? <div className="feedback"><strong>Твой выбор сохранён.</strong><p>{choices.find((item) => item.id === selected)?.description}</p></div> : null}
      <CareerCenterResources resources={resources} />
    </section>
  );
}
