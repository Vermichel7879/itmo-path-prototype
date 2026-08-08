import { CareerCenterResources } from "../components/CareerCenterResources";
import { GameEvent } from "../components/GameEvent";
import type { CareerCenterResource, GameEvent as GameEventData } from "../types/program";

interface Props {
  event: GameEventData;
  selected: string | null;
  resources: CareerCenterResource[];
  onSelect: (id: string) => void;
}

export function EventScreen({ event, selected, resources, onSelect }: Props) {
  return <section className="screen"><GameEvent event={event} selected={selected} onSelect={onSelect} />{selected ? <CareerCenterResources resources={resources} /> : null}</section>;
}
