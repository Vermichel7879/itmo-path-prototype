import computerTechnologiesJourney from "./computer-technologies.json";
import type { ProgramJourney } from "../../types/journey";

const journeys = [computerTechnologiesJourney as unknown as ProgramJourney];

export function getJourneyForProgram(programName: string | null): ProgramJourney | null {
  return journeys.find((journey) => journey.program.program_name === programName) ?? null;
}
