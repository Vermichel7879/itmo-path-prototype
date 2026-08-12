export type JourneyStepType =
  | "program_intro"
  | "career_choice"
  | "semester_summary"
  | "interest_choice"
  | "practice_choice"
  | "career_center_situation"
  | "result";

export interface JourneyContact {
  contact_id: string;
  title: string;
  type: "website" | "email" | "telegram" | "vk" | "phone" | "address";
  value: string;
  url: string;
  source_url: string;
  verified_on: string;
}

export interface JourneyCondition {
  step_id: string;
  option_id: string;
}

export interface JourneyOption {
  option_id: string;
  title: string;
  description?: string;
  discipline_refs?: string[];
  skill_refs?: string[];
  practice_refs?: string[];
  resource_refs?: string[];
  source_child_group_refs?: string[];
  learning_benefit?: string;
  career_context?: string;
  recommended_for_career_refs?: string[];
  recommendation_reason?: string;
  outcome?: string;
  outcome_by_career?: Record<string, string>;
  result_tags?: string[];
  next_step_id?: string;
}

export interface CareerDetail {
  career_ref: string;
  daily_tasks: string[];
  creates: string[];
  beginner_tasks: string[];
  related_discipline_refs: string[];
}

export interface JourneyStep {
  step_id: string;
  type: JourneyStepType;
  title: string;
  body?: string;
  intro?: string;
  semester?: number;
  estimated_seconds: number;
  next_step_id?: string;
  show_if?: JourneyCondition;
  save_as?: string;
  career_refs?: string[];
  career_details?: CareerDetail[];
  source_elective_group_ref?: string;
  choice_category?: string;
  options?: JourneyOption[];
  what_appears?: string;
  what_student_does?: string;
  what_student_learns?: string;
  where_it_is_used?: string;
  discipline_refs?: string[];
  situation?: string;
  program_specific_context?: string;
}

export interface ProgramJourney {
  schema_version: string;
  journey_id: string;
  program: {
    program_name: string;
    admission_year: number;
    database_schema_version: string;
  };
  experience: {
    target_duration_seconds: number;
    minimum_duration_seconds: number;
    maximum_duration_seconds: number;
    minimum_choices: number;
    maximum_choices: number;
    maximum_options_per_step: number;
    maximum_conditional_steps_per_route: number;
  };
  start_step_id: string;
  career_center_contacts: JourneyContact[];
  steps: JourneyStep[];
  result_config: {
    framing: string;
    sections: string[];
    prohibited_claims: string[];
  };
}

export type JourneyAnswers = Record<string, string>;
