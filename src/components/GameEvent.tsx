import type { GameEvent as GameEventData } from "../types/program";

interface Props {
  event: GameEventData;
  selected: string | null;
  onSelect: (id: string) => void;
}

export function GameEvent({ event, selected, onSelect }: Props) {
  const selectedOption = event.options.find((option) => option.id === selected);
  return (
    <>
      <h1>{event.title}</h1>
      <p>{event.description}</p>
      <div className="choice-list">
        {event.options.map((option) => (
          <label className={selected === option.id ? "choice selected" : "choice"} key={option.id}>
            <input type="radio" name={event.event_id} checked={selected === option.id} onChange={() => onSelect(option.id)} />
            <span><strong>{option.title}</strong></span>
          </label>
        ))}
      </div>
      {selectedOption ? (
        <div className="feedback" role="status">
          <h3>Что это даёт</h3>
          <ul>{selectedOption.effects.map((effect) => <li key={effect}>{effect}</li>)}</ul>
          <p>Здесь нет правильного или неправильного ответа — это один из возможных маршрутов.</p>
        </div>
      ) : null}
    </>
  );
}
