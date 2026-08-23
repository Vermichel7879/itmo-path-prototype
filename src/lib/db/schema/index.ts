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
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    unique("modules_id_version_unique").on(table.id, table.configVersionId),
    uniqueIndex("modules_version_stable_unique").on(
      table.configVersionId,
      table.stableId,
    ),
    index("modules_version_active_idx").on(table.configVersionId, table.active),
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
    active: boolean("active").default(true).notNull(),
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
    uniqueIndex("opportunities_stable_unique").on(table.stableId),
    index("opportunities_type_active_idx").on(table.type, table.active),
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
