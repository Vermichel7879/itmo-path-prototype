import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import type { EngineRule, ModifierOperation } from "../config/typed-rules";
import type { CareerImport, ModifierEffect } from "../import/import-model";

export const adminRoleEnum = pgEnum("admin_role", ["ADMIN", "EDITOR"]);
export const configStatusEnum = pgEnum("config_status", [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
]);
export const questionSelectionTypeEnum = pgEnum("question_selection_type", [
  "SINGLE",
  "MULTI",
]);
export const modifierTypeEnum = pgEnum("modifier_type", ["COPY", "PACE"]);
export const modifierTargetScopeEnum = pgEnum("modifier_target_scope", [
  "MODULE",
  "ALL",
]);
export const modifierOperationKindEnum = pgEnum(
  "modifier_operation_kind",
  [
    "REPLACE_STEP",
    "APPEND_ADJUSTMENT",
    "SET_PRIORITIES",
    "SET_PACE",
    "REPLACE_M11_STAGE",
    "APPEND_M11_CHALLENGE",
  ],
);
export const engineRuleKindEnum = pgEnum("engine_rule_kind", [
  "WEIGHTED_SCORING",
  "TIE_BREAK",
  "RESULT_COMPOSITION",
  "SUPPORT_SELECTION",
  "MODIFIER_APPLICATION",
  "RECOMMENDATION_SELECTION",
  "RECOMMENDATION_PREFERENCE",
  "PRIORITY_CAPTURE",
  "PACE_MAPPING",
  "RECOMMENDATION_DEDUPLICATION",
  "CONTENT_POLICY",
  "MODULE_GUARD",
  "CONDITIONAL_BRANCH",
  "ENTREPRENEUR_COMPOSITION",
  "FALLBACK_SELECTION",
]);
export const recommendationTypeEnum = pgEnum("recommendation_type", [
  "CKO_SERVICE",
  "EVENT",
  "CLUB",
  "FACULTY",
  "GENERAL",
]);
export const recommendationStatusEnum = pgEnum("recommendation_status", [
  "ACTIVE",
  "SLOT",
  "INACTIVE",
]);
export const opportunityTypeEnum = pgEnum("opportunity_type", [
  "EVENT",
  "CLUB",
  "FACULTY",
  "PRACTICE",
  "INTERNSHIP",
  "OTHER",
]);
export const educationLevelEnum = pgEnum("education_level", ["BACHELOR", "MASTER"]);
export const trajectorySessionStatusEnum = pgEnum("trajectory_session_status", [
  "IN_PROGRESS",
  "COMPLETED",
  "UNAVAILABLE",
]);
export const trajectoryModuleResultKindEnum = pgEnum(
  "trajectory_module_result_kind",
  ["PRIMARY", "SUPPORT"],
);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    username: varchar("username", { length: 120 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: adminRoleEnum("role").default("EDITOR").notNull(),
    active: boolean("active").default(true).notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("admin_users_username_unique").on(table.username),
    index("admin_users_active_idx").on(table.active),
    check("admin_users_username_not_blank", sql`length(trim(${table.username})) > 0`),
    check(
      "admin_users_password_hash_not_blank",
      sql`length(trim(${table.passwordHash})) > 0`,
    ),
  ],
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("admin_sessions_token_hash_unique").on(table.tokenHash),
    index("admin_sessions_user_idx").on(table.userId),
    index("admin_sessions_expiry_idx").on(table.expiresAt),
    check(
      "admin_sessions_token_hash_not_blank",
      sql`length(trim(${table.tokenHash})) >= 32`,
    ),
  ],
);

export const adminLoginAttempts = pgTable(
  "admin_login_attempts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    usernameHash: varchar("username_hash", { length: 64 }).notNull(),
    ipHash: varchar("ip_hash", { length: 64 }).notNull(),
    succeeded: boolean("succeeded").default(false).notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("admin_login_attempts_username_time_idx").on(
      table.usernameHash,
      table.attemptedAt,
    ),
    index("admin_login_attempts_ip_time_idx").on(
      table.ipHash,
      table.attemptedAt,
    ),
    check(
      "admin_login_attempts_username_hash_format",
      sql`${table.usernameHash} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "admin_login_attempts_ip_hash_format",
      sql`${table.ipHash} ~ '^[a-f0-9]{64}$'`,
    ),
  ],
);

export const configVersions = pgTable(
  "config_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    versionNumber: integer("version_number").notNull(),
    status: configStatusEnum("status").default("DRAFT").notNull(),
    label: varchar("label", { length: 180 }),
    sourceFileName: text("source_file_name"),
    sourceSha256: varchar("source_sha256", { length: 64 }),
    snapshot: jsonb("snapshot")
      .$type<CareerImport | Record<string, never>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdByAdminUserId: uuid("created_by_admin_user_id").references(
      () => adminUsers.id,
      { onDelete: "set null" },
    ),
    publishedByAdminUserId: uuid("published_by_admin_user_id").references(
      () => adminUsers.id,
      { onDelete: "set null" },
    ),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("config_versions_number_unique").on(table.versionNumber),
    uniqueIndex("config_versions_single_draft_unique")
      .on(table.status)
      .where(sql`${table.status} = 'DRAFT'`),
    index("config_versions_published_idx").on(table.status, table.publishedAt),
    check(
      "config_versions_number_positive",
      sql`${table.versionNumber} > 0`,
    ),
    check(
      "config_versions_publish_metadata",
      sql`(${table.status} <> 'PUBLISHED') OR (${table.publishedAt} IS NOT NULL)`,
    ),
    check(
      "config_versions_published_snapshot",
      sql`(${table.status} <> 'PUBLISHED') OR (${table.snapshot} <> '{}'::jsonb)`,
    ),
    check(
      "config_versions_source_hash_format",
      sql`${table.sourceSha256} IS NULL OR ${table.sourceSha256} ~ '^[A-F0-9]{64}$'`,
    ),
  ],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configVersionId: uuid("config_version_id")
      .notNull()
      .references(() => configVersions.id, { onDelete: "cascade" }),
    stableId: varchar("stable_id", { length: 40 }).notNull(),
    block: varchar("block", { length: 180 }).notNull(),
    text: text("text").notNull(),
    selectionType: questionSelectionTypeEnum("selection_type").notNull(),
    minSelect: integer("min_select").notNull(),
    maxSelect: integer("max_select").notNull(),
    required: boolean("required").default(true).notNull(),
    sortOrder: integer("sort_order").notNull(),
    showCondition: jsonb("show_condition").$type<{ expression: string } | null>(),
    active: boolean("active").default(true).notNull(),
    forBachelor: boolean("for_bachelor").default(false).notNull(),
    forMaster: boolean("for_master").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    unique("questions_id_version_unique").on(table.id, table.configVersionId),
    uniqueIndex("questions_version_stable_unique").on(
      table.configVersionId,
      table.stableId,
    ),
    uniqueIndex("questions_version_sort_unique").on(
      table.configVersionId,
      table.sortOrder,
    ),
    index("questions_version_active_idx").on(table.configVersionId, table.active),
    check("questions_min_nonnegative", sql`${table.minSelect} >= 0`),
    check("questions_max_positive", sql`${table.maxSelect} > 0`),
    check("questions_min_lte_max", sql`${table.minSelect} <= ${table.maxSelect}`),
    check(
      "questions_required_min",
      sql`NOT ${table.required} OR ${table.minSelect} >= 1`,
    ),
    check(
      "questions_single_max",
      sql`${table.selectionType} <> 'SINGLE' OR ${table.maxSelect} = 1`,
    ),
    check("questions_sort_positive", sql`${table.sortOrder} > 0`),
  ],
);

export const answers = pgTable(
  "answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configVersionId: uuid("config_version_id")
      .notNull()
      .references(() => configVersions.id, { onDelete: "cascade" }),
    questionId: uuid("question_id").notNull(),
    stableId: varchar("stable_id", { length: 60 }).notNull(),
    text: text("text").notNull(),
    sortOrder: integer("sort_order").notNull(),
    tags: jsonb("tags").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    keys: jsonb("keys").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    unique("answers_id_version_unique").on(table.id, table.configVersionId),
    uniqueIndex("answers_version_stable_unique").on(
      table.configVersionId,
      table.stableId,
    ),
    uniqueIndex("answers_question_sort_unique").on(
      table.questionId,
      table.sortOrder,
    ),
    index("answers_version_active_idx").on(table.configVersionId, table.active),
    foreignKey({
      name: "answers_question_version_fk",
      columns: [table.questionId, table.configVersionId],
      foreignColumns: [questions.id, questions.configVersionId],
    }).onDelete("cascade"),
    check("answers_sort_positive", sql`${table.sortOrder} > 0`),
  ],
);

export const modules = pgTable(
  "modules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configVersionId: uuid("config_version_id")
      .notNull()
      .references(() => configVersions.id, { onDelete: "cascade" }),
    stableId: varchar("stable_id", { length: 40 }).notNull(),
    name: varchar("name", { length: 240 }).notNull(),
    goal: text("goal").notNull(),
    step1: text("step_1").notNull(),
    step2: text("step_2").notNull(),
    step3: text("step_3").notNull(),
    checkpoint: text("checkpoint").notNull(),
    constraints: text("constraints").default("").notNull(),
    sortOrder: integer("sort_order"),
    active: boolean("active").default(true).notNull(),
    forBachelor: boolean("for_bachelor").default(false).notNull(),
    forMaster: boolean("for_master").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    unique("modules_id_version_unique").on(table.id, table.configVersionId),
    uniqueIndex("modules_version_stable_unique").on(
      table.configVersionId,
      table.stableId,
    ),
    uniqueIndex("modules_version_sort_unique").on(
      table.configVersionId,
      table.sortOrder,
    ),
    index("modules_version_active_idx").on(table.configVersionId, table.active),
    check(
      "modules_sort_positive",
      sql`${table.sortOrder} IS NULL OR ${table.sortOrder} > 0`,
    ),
  ],
);

export const answerModuleWeights = pgTable(
  "answer_module_weights",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configVersionId: uuid("config_version_id")
      .notNull()
      .references(() => configVersions.id, { onDelete: "cascade" }),
    answerId: uuid("answer_id").notNull(),
    moduleId: uuid("module_id").notNull(),
    weight: integer("weight").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("answer_module_weights_unique").on(
      table.configVersionId,
      table.answerId,
      table.moduleId,
    ),
    index("answer_module_weights_answer_idx").on(table.answerId),
    index("answer_module_weights_module_idx").on(table.moduleId),
    foreignKey({
      name: "answer_module_weights_answer_version_fk",
      columns: [table.answerId, table.configVersionId],
      foreignColumns: [answers.id, answers.configVersionId],
    }).onDelete("cascade"),
    foreignKey({
      name: "answer_module_weights_module_version_fk",
      columns: [table.moduleId, table.configVersionId],
      foreignColumns: [modules.id, modules.configVersionId],
    }).onDelete("cascade"),
  ],
);

export const modifiers = pgTable(
  "modifiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configVersionId: uuid("config_version_id")
      .notNull()
      .references(() => configVersions.id, { onDelete: "cascade" }),
    stableId: varchar("stable_id", { length: 40 }).notNull(),
    triggerAnswerId: uuid("trigger_answer_id"),
    triggerAnswerPattern: varchar("trigger_answer_pattern", { length: 80 }).notNull(),
    triggerTag: varchar("trigger_tag", { length: 120 }),
    targetScope: modifierTargetScopeEnum("target_scope").notNull(),
    targetModuleId: uuid("target_module_id"),
    type: modifierTypeEnum("type").notNull(),
    variantKey: varchar("variant_key", { length: 120 }).notNull(),
    effect: jsonb("effect").$type<ModifierEffect>().notNull(),
    operationKind: modifierOperationKindEnum("operation_kind"),
    operationParams: jsonb("operation_params").$type<ModifierOperation["params"]>(),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    unique("modifiers_id_version_unique").on(table.id, table.configVersionId),
    uniqueIndex("modifiers_version_stable_unique").on(
      table.configVersionId,
      table.stableId,
    ),
    index("modifiers_trigger_idx").on(table.triggerAnswerId),
    index("modifiers_target_idx").on(table.targetModuleId),
    foreignKey({
      name: "modifiers_answer_version_fk",
      columns: [table.triggerAnswerId, table.configVersionId],
      foreignColumns: [answers.id, answers.configVersionId],
    }).onDelete("cascade"),
    foreignKey({
      name: "modifiers_module_version_fk",
      columns: [table.targetModuleId, table.configVersionId],
      foreignColumns: [modules.id, modules.configVersionId],
    }).onDelete("cascade"),
    check(
      "modifiers_target_scope_consistent",
      sql`(${table.targetScope} = 'ALL' AND ${table.targetModuleId} IS NULL) OR (${table.targetScope} = 'MODULE' AND ${table.targetModuleId} IS NOT NULL)`,
    ),
    check(
      "modifiers_operation_complete",
      sql`(${table.operationKind} IS NULL AND ${table.operationParams} IS NULL) OR (${table.operationKind} IS NOT NULL AND ${table.operationParams} IS NOT NULL)`,
    ),
  ],
);

export const engineRules = pgTable(
  "engine_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configVersionId: uuid("config_version_id")
      .notNull()
      .references(() => configVersions.id, { onDelete: "cascade" }),
    stableId: varchar("stable_id", { length: 40 }).notNull(),
    ruleKind: engineRuleKindEnum("rule_kind").notNull(),
    params: jsonb("params").$type<EngineRule["params"]>().notNull(),
    sourceTitle: text("source_title").notNull(),
    sourceContent: text("source_content").notNull(),
    sortOrder: integer("sort_order").notNull(),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("engine_rules_version_stable_unique").on(
      table.configVersionId,
      table.stableId,
    ),
    uniqueIndex("engine_rules_version_sort_unique").on(
      table.configVersionId,
      table.sortOrder,
    ),
    index("engine_rules_version_kind_idx").on(
      table.configVersionId,
      table.ruleKind,
    ),
    check("engine_rules_sort_positive", sql`${table.sortOrder} > 0`),
    check(
      "engine_rules_stable_id_format",
      sql`${table.stableId} ~ '^R(0[1-9]|1[0-7])$'`,
    ),
    check(
      "engine_rules_source_not_blank",
      sql`length(trim(${table.sourceTitle})) > 0 AND length(trim(${table.sourceContent})) > 0`,
    ),
  ],
);

export const documentationExamples = pgTable(
  "documentation_examples",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configVersionId: uuid("config_version_id")
      .notNull()
      .references(() => configVersions.id, { onDelete: "cascade" }),
    stableId: varchar("stable_id", { length: 40 }).notNull(),
    inputSummary: text("input_summary").notNull(),
    expectedModuleSummary: text("expected_module_summary").notNull(),
    primaryFocus: text("primary_focus").notNull(),
    stepsSummary: text("steps_summary").notNull(),
    recommendationsSummary: text("recommendations_summary").notNull(),
    sortOrder: integer("sort_order").notNull(),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("documentation_examples_version_stable_unique").on(
      table.configVersionId,
      table.stableId,
    ),
    uniqueIndex("documentation_examples_version_sort_unique").on(
      table.configVersionId,
      table.sortOrder,
    ),
    check("documentation_examples_sort_positive", sql`${table.sortOrder} > 0`),
    check(
      "documentation_examples_stable_id_format",
      sql`${table.stableId} ~ '^E0[1-7]$'`,
    ),
  ],
);

export const recommendations = pgTable(
  "recommendations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configVersionId: uuid("config_version_id")
      .notNull()
      .references(() => configVersions.id, { onDelete: "cascade" }),
    stableId: varchar("stable_id", { length: 80 }).notNull(),
    type: recommendationTypeEnum("type").notNull(),
    title: varchar("title", { length: 280 }).notNull(),
    description: text("description").notNull(),
    url: text("url"),
    status: recommendationStatusEnum("status").default("ACTIVE").notNull(),
    tags: jsonb("tags").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    priorityTags: jsonb("priority_tags")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    active: boolean("active").default(true).notNull(),
    forBachelor: boolean("for_bachelor").default(false).notNull(),
    forMaster: boolean("for_master").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    unique("recommendations_id_version_unique").on(table.id, table.configVersionId),
    uniqueIndex("recommendations_version_stable_unique").on(
      table.configVersionId,
      table.stableId,
    ),
    index("recommendations_type_active_idx").on(table.type, table.active),
  ],
);

export const moduleRecommendations = pgTable(
  "module_recommendations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configVersionId: uuid("config_version_id")
      .notNull()
      .references(() => configVersions.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id").notNull(),
    recommendationId: uuid("recommendation_id").notNull(),
    priority: integer("priority").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("module_recommendations_unique").on(
      table.configVersionId,
      table.moduleId,
      table.recommendationId,
    ),
    index("module_recommendations_module_priority_idx").on(
      table.moduleId,
      table.priority,
    ),
    foreignKey({
      name: "module_recommendations_module_version_fk",
      columns: [table.moduleId, table.configVersionId],
      foreignColumns: [modules.id, modules.configVersionId],
    }).onDelete("cascade"),
    foreignKey({
      name: "module_recommendations_recommendation_version_fk",
      columns: [table.recommendationId, table.configVersionId],
      foreignColumns: [recommendations.id, recommendations.configVersionId],
    }).onDelete("cascade"),
    check("module_recommendations_priority_positive", sql`${table.priority} > 0`),
  ],
);

export const opportunities = pgTable(
  "opportunities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configVersionId: uuid("config_version_id")
      .notNull()
      .references(() => configVersions.id, { onDelete: "cascade" }),
    stableId: varchar("stable_id", { length: 100 }).notNull(),
    type: opportunityTypeEnum("type").notNull(),
    title: varchar("title", { length: 280 }).notNull(),
    description: text("description").notNull(),
    url: text("url"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validTo: timestamp("valid_to", { withTimezone: true }),
    tags: jsonb("tags").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    unique("opportunities_id_version_unique").on(
      table.id,
      table.configVersionId,
    ),
    uniqueIndex("opportunities_version_stable_unique").on(
      table.configVersionId,
      table.stableId,
    ),
    index("opportunities_version_type_active_idx").on(
      table.configVersionId,
      table.type,
      table.active,
    ),
    index("opportunities_validity_idx").on(table.validFrom, table.validTo),
    check(
      "opportunities_date_order",
      sql`${table.startsAt} IS NULL OR ${table.endsAt} IS NULL OR ${table.startsAt} <= ${table.endsAt}`,
    ),
    check(
      "opportunities_validity_order",
      sql`${table.validFrom} IS NULL OR ${table.validTo} IS NULL OR ${table.validFrom} <= ${table.validTo}`,
    ),
  ],
);

export const entrepreneurStages = pgTable(
  "entrepreneur_stages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configVersionId: uuid("config_version_id")
      .notNull()
      .references(() => configVersions.id, { onDelete: "cascade" }),
    stableId: varchar("stable_id", { length: 80 }).notNull(),
    answerId: uuid("answer_id").notNull(),
    targetModuleId: uuid("target_module_id").notNull(),
    answerText: text("answer_text").notNull(),
    focus: text("focus").notNull(),
    step1: text("step_1").notNull(),
    step2: text("step_2").notNull(),
    step3: text("step_3").notNull(),
    checkpoint: text("checkpoint").notNull(),
    sortOrder: integer("sort_order").notNull(),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    unique("entrepreneur_stages_id_version_unique").on(
      table.id,
      table.configVersionId,
    ),
    uniqueIndex("entrepreneur_stages_version_stable_unique").on(
      table.configVersionId,
      table.stableId,
    ),
    uniqueIndex("entrepreneur_stages_answer_unique").on(
      table.configVersionId,
      table.answerId,
    ),
    foreignKey({
      name: "entrepreneur_stages_answer_version_fk",
      columns: [table.answerId, table.configVersionId],
      foreignColumns: [answers.id, answers.configVersionId],
    }).onDelete("cascade"),
    foreignKey({
      name: "entrepreneur_stages_module_version_fk",
      columns: [table.targetModuleId, table.configVersionId],
      foreignColumns: [modules.id, modules.configVersionId],
    }).onDelete("cascade"),
    check("entrepreneur_stages_sort_positive", sql`${table.sortOrder} > 0`),
  ],
);

export const entrepreneurChallenges = pgTable(
  "entrepreneur_challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configVersionId: uuid("config_version_id")
      .notNull()
      .references(() => configVersions.id, { onDelete: "cascade" }),
    stableId: varchar("stable_id", { length: 80 }).notNull(),
    answerId: uuid("answer_id").notNull(),
    targetModuleId: uuid("target_module_id").notNull(),
    recommendationId: uuid("recommendation_id").notNull(),
    answerText: text("answer_text").notNull(),
    trajectoryAdjustment: text("trajectory_adjustment").notNull(),
    sortOrder: integer("sort_order").notNull(),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    unique("entrepreneur_challenges_id_version_unique").on(
      table.id,
      table.configVersionId,
    ),
    uniqueIndex("entrepreneur_challenges_version_stable_unique").on(
      table.configVersionId,
      table.stableId,
    ),
    uniqueIndex("entrepreneur_challenges_answer_unique").on(
      table.configVersionId,
      table.answerId,
    ),
    foreignKey({
      name: "entrepreneur_challenges_answer_version_fk",
      columns: [table.answerId, table.configVersionId],
      foreignColumns: [answers.id, answers.configVersionId],
    }).onDelete("cascade"),
    foreignKey({
      name: "entrepreneur_challenges_module_version_fk",
      columns: [table.targetModuleId, table.configVersionId],
      foreignColumns: [modules.id, modules.configVersionId],
    }).onDelete("cascade"),
    foreignKey({
      name: "entrepreneur_challenges_recommendation_version_fk",
      columns: [table.recommendationId, table.configVersionId],
      foreignColumns: [recommendations.id, recommendations.configVersionId],
    }).onDelete("cascade"),
    check("entrepreneur_challenges_sort_positive", sql`${table.sortOrder} > 0`),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorAdminUserId: uuid("actor_admin_user_id").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    configVersionId: uuid("config_version_id").references(() => configVersions.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entity_type", { length: 120 }).notNull(),
    entityId: varchar("entity_id", { length: 160 }),
    previousValue: jsonb("previous_value").$type<unknown>(),
    newValue: jsonb("new_value").$type<unknown>(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_log_actor_idx").on(table.actorAdminUserId, table.createdAt),
    index("audit_log_config_idx").on(table.configVersionId, table.createdAt),
    index("audit_log_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const trajectorySessions = pgTable(
  "trajectory_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    isu: text("isu").notNull(),
    educationLevel: educationLevelEnum("education_level").notNull(),
    configVersionId: uuid("config_version_id")
      .notNull()
      .references(() => configVersions.id, { onDelete: "restrict" }),
    status: trajectorySessionStatusEnum("status").notNull(),
    primaryModuleId: varchar("primary_module_id", { length: 40 }),
    resultSnapshot: jsonb("result_snapshot").$type<Record<string, unknown> | null>(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("trajectory_sessions_isu_idx").on(table.isu),
    index("trajectory_sessions_config_idx").on(table.configVersionId),
    index("trajectory_sessions_status_idx").on(table.status),
    check("trajectory_sessions_isu_digits", sql`${table.isu} ~ '^[0-9]+$'`),
    check(
      "trajectory_sessions_completion_consistent",
      sql`(${table.status} = 'COMPLETED' AND ${table.completedAt} IS NOT NULL AND ${table.resultSnapshot} IS NOT NULL) OR (${table.status} <> 'COMPLETED' AND ${table.completedAt} IS NULL)`,
    ),
  ],
);

export const sessionAnswers = pgTable(
  "session_answers",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sessionId: uuid("session_id").notNull().references(() => trajectorySessions.id, { onDelete: "cascade" }),
    questionId: varchar("question_id", { length: 40 }).notNull(),
    answerOptionId: varchar("answer_option_id", { length: 60 }).notNull(),
    selectedAt: timestamp("selected_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("session_answers_selection_unique").on(table.sessionId, table.questionId, table.answerOptionId),
    index("session_answers_session_question_idx").on(table.sessionId, table.questionId),
  ],
);

export const sessionModuleScores = pgTable(
  "session_module_scores",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sessionId: uuid("session_id").notNull().references(() => trajectorySessions.id, { onDelete: "cascade" }),
    moduleId: varchar("module_id", { length: 40 }).notNull(),
    totalScore: integer("total_score").notNull(),
    finalRank: integer("final_rank").notNull(),
    q2Score: integer("q2_score").default(0).notNull(),
    q3Score: integer("q3_score").default(0).notNull(),
    q1Score: integer("q1_score").default(0).notNull(),
    q5Score: integer("q5_score").default(0).notNull(),
  },
  (table) => [uniqueIndex("session_module_scores_unique").on(table.sessionId, table.moduleId)],
);

export const sessionScoreContributions = pgTable(
  "session_score_contributions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sessionId: uuid("session_id").notNull().references(() => trajectorySessions.id, { onDelete: "cascade" }),
    questionId: varchar("question_id", { length: 40 }).notNull(),
    answerOptionId: varchar("answer_option_id", { length: 60 }).notNull(),
    moduleId: varchar("module_id", { length: 40 }).notNull(),
    weight: integer("weight").notNull(),
  },
  (table) => [index("session_score_contributions_session_idx").on(table.sessionId)],
);

export const sessionModuleResults = pgTable(
  "session_module_results",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sessionId: uuid("session_id").notNull().references(() => trajectorySessions.id, { onDelete: "cascade" }),
    moduleId: varchar("module_id", { length: 40 }).notNull(),
    kind: trajectoryModuleResultKindEnum("kind").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [uniqueIndex("session_module_results_unique").on(table.sessionId, table.kind, table.position)],
);

export const sessionRecommendations = pgTable(
  "session_recommendations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sessionId: uuid("session_id").notNull().references(() => trajectorySessions.id, { onDelete: "cascade" }),
    recommendationId: varchar("recommendation_id", { length: 100 }).notNull(),
    position: integer("position").notNull(),
    sourceModuleId: varchar("source_module_id", { length: 40 }),
  },
  (table) => [uniqueIndex("session_recommendations_unique").on(table.sessionId, table.position)],
);
