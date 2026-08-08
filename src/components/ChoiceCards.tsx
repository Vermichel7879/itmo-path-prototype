import type { PrototypeChoice } from "../data/prototypeChoices";

interface Props {
  name: string;
  choices: PrototypeChoice[];
  selected: string | null;
  onSelect: (choice: PrototypeChoice) => void;
  descriptions?: Record<string, string>;
}

export function ChoiceCards({ name, choices, selected, onSelect, descriptions }: Props) {
  return (
    <div className="choice-list">
      {choices.map((choice) => (
        <label className={selected === choice.id ? "choice selected" : "choice"} key={choice.id}>
          <input type="radio" name={name} checked={selected === choice.id} onChange={() => onSelect(choice)} />
          <span>
            <strong>{choice.title}</strong>
            <small>{descriptions?.[choice.id] ?? choice.description}</small>
          </span>
        </label>
      ))}
    </div>
  );
}
