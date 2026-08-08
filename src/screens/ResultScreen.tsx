import { ResultRoute } from "../components/ResultRoute";
import type { FinalRoute } from "../game/routeBuilder";

export function ResultScreen({ route, routeNumber }: { route: FinalRoute; routeNumber: string }) {
  return <section className="screen"><ResultRoute route={route} routeNumber={routeNumber} /></section>;
}
