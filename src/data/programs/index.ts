import laserTechnologies from "./laser-technologies.json";
import computerTechnologiesDesign from "./computer-technologies-design.json";
import computerTechnologies from "./computer-technologies.json";
import type { ProgramDatabase } from "../../types/program";

const databases = [laserTechnologies, computerTechnologiesDesign, computerTechnologies] as unknown as ProgramDatabase[];

export interface ProgramEntry {
  id: string;
  database: ProgramDatabase;
}

// The identity comes from JSON content, never from the imported filename.
export const programs: ProgramEntry[] = databases.map((database) => ({
  id: database.program.program_name,
  database,
}));

export function getProgramById(id: string | null): ProgramDatabase | null {
  return programs.find((entry) => entry.id === id)?.database ?? null;
}
