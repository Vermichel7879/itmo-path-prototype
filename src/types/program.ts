export type Confidence = "low" | "medium" | "high";
export type SelectionMode = "all" | "choose_n_disciplines" | "choose_n_groups" | "choose_credits";

export interface ProgramInfo {
  program_name: string;
  admission_year: number;
  direction_code: string;
  direction_name: string;
  education_level: string;
  study_form: string;
  duration_years: number;
  program_language: string;
  official_page: string;
  positioning?: string;
  tracks?: string[];
}

export interface Career {
  career_id: string;
  title: string;
  title_en?: string;
  short_description: string;
  what_you_do: string[];
  key_skills: string[];
  specializations: string[];
  why_this_program: string;
  entry_level_examples: string[];
  confidence?: Confidence;
}

export interface Skill {
  skill_id: string;
  title: string;
  category: string;
  description: string;
  source_discipline_ids: string[];
  career_ids: string[];
  confidence?: Confidence;
}

export interface Discipline {
  discipline_id: string;
  source_id?: string;
  name: string;
  semesters: number[];
  credits: number;
  choice_type?: string;
  module?: string;
  elective_group_id?: string | null;
  role?: string;
  simple_description?: string;
  what_you_learn?: string[];
  skills: string[];
  career_relevance?: Record<string, string>;
  data_quality?: Record<string, unknown>;
}

export interface ElectiveOption {
  discipline_id: string;
  simple_description?: string;
  skills: string[];
  career_fit: Record<string, number>;
}

export interface ElectiveGroup {
  group_id: string;
  name: string;
  semesters: number[];
  selection_mode: SelectionMode;
  required_count: number | null;
  required_credits: number | null;
  parent_module_id?: string;
  child_group_ids: string[];
  options: ElectiveOption[];
}

export interface Practice {
  practice_id: string;
  name: string;
  semesters: number[];
  credits?: number;
  description?: string;
}

export interface TimelineSemester {
  semester: number;
  mandatory_highlights: string[];
  elective_decisions: string[];
  skills_focus: string[];
  career_stage: string;
  recommended_actions: string[];
}

export interface CareerAction {
  action_id: string;
  title: string;
  description: string;
  recommended_semesters: number[];
  career_ids: string[];
  career_center_resources: string[];
  reason: string;
}

export interface CareerCenterResource {
  resource_id: string;
  title: string;
  type: string;
  direct_url: string | null;
}

export interface GameEventOption {
  id: string;
  title: string;
  effects: string[];
}

export interface GameEvent {
  event_id: string;
  semester: number;
  title: string;
  description: string;
  options: GameEventOption[];
}

export interface RecommendedElective {
  group_id: string;
  discipline_id: string;
  priority: "primary" | "alternative" | string;
  reason: string;
}

export interface CareerRoute {
  career_id: string;
  summary: string;
  key_skills: string[];
  core_disciplines: string[];
  recommended_electives: RecommendedElective[];
  timeline_highlights: Record<string, string[]>;
  career_actions: string[];
  career_center_resources: string[];
}

export interface ProgramDatabase {
  schema_version: string;
  program: ProgramInfo;
  source_summary: Record<string, unknown>;
  careers: Career[];
  skills: Skill[];
  disciplines: Discipline[];
  elective_groups: ElectiveGroup[];
  practices: Practice[];
  timeline: TimelineSemester[];
  career_actions: CareerAction[];
  career_center: { name: string; resources: CareerCenterResource[] };
  game_events: GameEvent[];
  career_routes: CareerRoute[];
  disclaimer: string;
}
