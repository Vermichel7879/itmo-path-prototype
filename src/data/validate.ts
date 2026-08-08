import type { ProgramDatabase } from "../types/program";

export function validateProgramDatabase(database: ProgramDatabase): string[] {
  const warnings: string[] = [];
  const label = database.program?.program_name ?? "Неизвестная программа";
  if (!database.program) warnings.push(`${label}: отсутствует program`);
  if (!database.careers?.length) warnings.push(`${label}: careers пуст`);
  if (!database.skills?.length) warnings.push(`${label}: skills пуст`);
  if (!database.disciplines?.length) warnings.push(`${label}: disciplines пуст`);
  if (!database.timeline?.length) warnings.push(`${label}: timeline пуст`);
  if (!database.career_routes?.length) warnings.push(`${label}: career_routes пуст`);
  if (!database.game_events?.length) warnings.push(`${label}: game_events пуст`);
  for (const career of database.careers ?? []) {
    if (!database.career_routes.some((route) => route.career_id === career.career_id)) {
      warnings.push(`${label}: нет career route для ${career.career_id}`);
    }
  }
  return warnings;
}

export function validatePrograms(databases: ProgramDatabase[]): void {
  if (!import.meta.env.DEV) return;
  for (const warning of databases.flatMap(validateProgramDatabase)) console.warn(warning);
}
