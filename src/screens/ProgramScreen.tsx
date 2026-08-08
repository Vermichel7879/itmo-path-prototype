import { useState } from "react";
import type { ProgramEntry } from "../data/programs";

interface Props {
  programs: ProgramEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ProgramScreen({ programs, selectedId, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("ru");
  // TODO: replace with official program category taxonomy if a confirmed taxonomy appears.
  const filtered = programs.filter(({ database }) =>
    [database.program.program_name, database.program.direction_name]
      .some((value) => value.toLocaleLowerCase("ru").includes(normalized)),
  );
  return (
    <section className="screen">
      <h1>Выбери образовательную программу</h1>
      <label className="search-label" htmlFor="program-search">Поиск программы</label>
      <input id="program-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название программы или направления" />
      <div className="card-grid">
        {filtered.map(({ id, database }) => (
          <article className={selectedId === id ? "card selected" : "card"} key={id}>
            <h2>{database.program.program_name}</h2>
            <p><strong>{database.program.direction_code}</strong></p>
            <p>{database.program.direction_name}</p>
            <button type="button" className={selectedId === id ? "secondary" : ""} onClick={() => onSelect(id)}>{selectedId === id ? "Выбрано" : "Выбрать"}</button>
          </article>
        ))}
      </div>
      {!filtered.length ? <p>По этому запросу программы не найдены.</p> : null}
    </section>
  );
}
