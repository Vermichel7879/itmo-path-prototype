"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { AdminPreviewExplanation } from "@/lib/admin/preview-debug";
import type { EducationLevel } from "@/lib/career/audience";
import type { PublicQuestionnaireDTO } from "@/lib/public-config/questionnaire";
import type { TrajectoryDebug, TrajectoryResult } from "@/lib/rule-engine/types";
import { patchRelationUpdate } from "./relation-update";
import {
  canCalculatePreview,
  previewRadioGroupName,
  selectedPreviewAnswerIds,
  updatePreviewAnswer,
  visiblePreviewQuestions,
  type PreviewAnswers,
} from "./preview-state";
import {
  buildRelationFocusOptions,
  buildRelationMapModel,
  buildStructuralCounters,
  structuralCounterLabel,
  type RelationEntity,
  type RelationEntityKind,
} from "./relation-map";

type Json = Record<string, unknown>;
type Draft = { id: string; updatedAt: string; snapshot: Json; validation: { valid: boolean; issues: Json[] } };

function RelationNumberControl({
  label,
  value,
  min,
  max,
  pending,
  onSave,
  onDelete,
}: {
  label: "Weight" | "Priority";
  value: number;
  min: number;
  max?: number;
  pending: boolean;
  onSave: (value: number) => void;
  onDelete: () => void;
}) {
  const [draftValue, setDraftValue] = useState(String(value));

  useEffect(() => setDraftValue(String(value)), [value]);

  const numericValue = Number(draftValue);
  const valid = draftValue.trim() !== "" && Number.isInteger(numericValue) &&
    numericValue >= min && (max === undefined || numericValue <= max);

  return (
    <div className="admin-mapping-link__controls">
      <label>
        {label}
        <input
          type="number"
          min={min}
          max={max}
          step="1"
          value={draftValue}
          onChange={(event) => setDraftValue(event.currentTarget.value)}
          required
        />
      </label>
      <button
        className="button-secondary"
        type="button"
        disabled={pending || !valid}
        onClick={() => onSave(numericValue)}
      >
        Сохранить {label.toLowerCase()}
      </button>
      <button className="button-secondary" type="button" disabled={pending} onClick={onDelete}>
        Удалить связь
      </button>
    </div>
  );
}

const sectionConfig: Record<string, { key: string; title: string; entityType: string }> = {
  questionnaire: { key: "questions", title: "Анкета", entityType: "QUESTION" },
  answers: { key: "answers", title: "Ответы", entityType: "ANSWER" },
  modules: { key: "modules", title: "Модули", entityType: "MODULE" },
  recommendations: { key: "recommendations", title: "Рекомендации", entityType: "RECOMMENDATION" },
  opportunities: { key: "opportunities", title: "Возможности", entityType: "OPPORTUNITY" },
  modifiers: { key: "modifiers", title: "Модификаторы", entityType: "MODIFIER" },
  rules: { key: "engineRules", title: "Правила R01–R17", entityType: "RULE" },
  mappings: { key: "mappings", title: "Веса и маппинги", entityType: "WEIGHT" },
};

function AdminDashboard() {
  const [data, setData] = useState<Json | null>(null);
  useEffect(() => { void fetch("/api/admin/dashboard").then((r) => r.json()).then(setData); }, []);
  if (!data) return <p>Загрузка…</p>;
  const counts = data.counts as Json;
  const draft = data.draft as Json;
  const published = data.published as Json;
  return <><header className="admin-heading"><div><p className="eyebrow">PHASE 4</p><h1>Обзор</h1></div><span className="admin-status">DB OK</span></header><div className="admin-grid"><article className="admin-card"><h2>Current DRAFT</h2><code>{String(draft.id)}</code><p>Обновлён: {new Date(String(draft.updatedAt)).toLocaleString("ru")}</p></article><article className="admin-card"><h2>Latest PUBLISHED</h2><code>{String(published.id)}</code><p>{published.publishedAt ? new Date(String(published.publishedAt)).toLocaleString("ru") : "—"}</p></article>{Object.entries(counts).map(([key, value]) => <article className="admin-card admin-card--metric" key={key}><strong>{String(value)}</strong><span>{key}</span></article>)}</div></>;
}

function valueFields(entityType: string) {
  if (entityType === "QUESTION") return ["text", "block", "minSelect", "maxSelect", "sortOrder", "required", "active", "forBachelor", "forMaster"];
  if (entityType === "ANSWER") return ["text", "tags", "keys", "sortOrder", "active"];
  if (entityType === "MODULE") return ["name", "goal", "step1", "step2", "step3", "checkpoint", "constraints", "sortOrder", "active", "forBachelor", "forMaster"];
  if (entityType === "RECOMMENDATION") return ["title", "description", "url", "status", "active", "forBachelor", "forMaster"];
  if (entityType === "OPPORTUNITY") return ["type", "title", "description", "url", "startsAt", "endsAt", "validFrom", "validTo", "active"];
  if (entityType === "RULE") return ["sourceTitle", "sourceContent", "active"];
  if (entityType === "MODIFIER") return ["active"];
  if (entityType === "WEIGHT") return ["weight"];
  return [];
}

function normalizeItem(entityType: string, raw: Json) {
  if (entityType === "MODULE") {
    const steps = raw.steps as string[];
    return { ...raw, step1: steps?.[0], step2: steps?.[1], step3: steps?.[2] };
  }
  return raw;
}

function audienceLabel(item: Json) {
  if (item.forBachelor && item.forMaster) return "Бакалавриат + Магистратура";
  if (item.forBachelor) return "Бакалавриат";
  if (item.forMaster) return "Магистратура";
  return "Аудитория не выбрана";
}

function mappingErrorMessage(code: string | undefined) {
  const messages: Record<string, string> = {
    MAPPING_ALREADY_EXISTS: "Этот ответ уже связан с выбранным модулем.",
    MAPPING_NOT_FOUND: "Связь уже удалена или не существует. Обновите страницу.",
    MAPPING_AUDIENCE_INCOMPATIBLE: "Аудитории вопроса и модуля не пересекаются.",
    ANSWER_NOT_FOUND: "Ответ больше не существует. Обновите страницу.",
    MODULE_NOT_FOUND: "Модуль больше не существует. Обновите страницу.",
    WEIGHT_REFERENCE_NOT_FOUND: "Ответ или модуль больше не существует.",
    INVALID_DRAFT_MUTATION: "Weight должен быть целым числом от −10 до 10.",
    DRAFT_MUTATION_INVALID_CONFIG: "Изменение нарушает целостность DRAFT-конфигурации.",
    ADMIN_OPERATION_FAILED: "Изменение не прошло серверную проверку DRAFT-конфигурации.",
    ADMIN_DATA_INVALID: "Параметры связи не прошли серверную проверку.",
    ADMIN_DATA_API_ERROR: "Сервер не смог выполнить изменение. Обновите страницу и попробуйте снова.",
    DRAFT_STALE_REVISION: "DRAFT изменён другим пользователем. Обновите страницу.",
    ADMIN_FORBIDDEN: "Изменять mappings может только ADMIN.",
    ADMIN_UNAUTHENTICATED: "Сессия завершена. Войдите в админку снова.",
  };
  return messages[code ?? ""] ?? "Не удалось изменить связь. Обновите страницу и попробуйте снова.";
}

function audiencesIntersect(first: Json | undefined, second: Json) {
  if (!first) return false;
  return Boolean(
    (first.forBachelor && second.forBachelor) ||
    (first.forMaster && second.forMaster),
  );
}

function AnswerMappings({
  answer,
  draft,
  role,
  onReload,
}: {
  answer: Json;
  draft: Draft;
  role: "ADMIN" | "EDITOR";
  onReload: () => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const questions = draft.snapshot.questions as Json[];
  const modules = draft.snapshot.modules as Json[];
  const mappings = draft.snapshot.mappings as Json[];
  const answerStableId = String(answer.stableId);
  const question = questions.find(
    (candidate) => candidate.stableId === answer.questionStableId,
  );
  const linked = mappings.filter(
    (mapping) => mapping.answerStableId === answerStableId,
  );
  const linkedModuleIds = new Set(linked.map((mapping) => mapping.moduleStableId));
  const availableModules = modules.filter(
    (careerModule) =>
      careerModule.active !== false &&
      !linkedModuleIds.has(careerModule.stableId) &&
      audiencesIntersect(question, careerModule),
  );

  async function mutateMapping(
    operation: "CREATE" | "UPDATE" | "DELETE",
    moduleStableId: string,
    weight: number | null,
  ) {
    const careerModule = modules.find((candidate) => candidate.stableId === moduleStableId);
    const moduleLabel = `${moduleStableId} · ${String(careerModule?.name ?? "Модуль")}`;
    const confirmation = operation === "DELETE"
      ? `Удалить только связь ${answerStableId} → ${moduleLabel}? Ответ и модуль останутся без изменений.`
      : operation === "CREATE"
        ? `Добавить связь ${answerStableId} → ${moduleLabel} с weight ${weight}?`
        : `Изменить weight связи ${answerStableId} → ${moduleLabel} на ${weight}?`;
    if (!window.confirm(confirmation)) return false;

    const key = `${operation}:${moduleStableId}`;
    setPendingKey(key);
    setMessage("");
    try {
      const update = operation === "UPDATE"
        ? await patchRelationUpdate({
          entityType: "MAPPING_UPDATE",
          stableId: `${answerStableId}:${moduleStableId}`,
          expectedUpdatedAt: draft.updatedAt,
          valueName: "weight",
          value: Number(weight),
        })
        : await (async () => {
          const response = await fetch("/api/admin/draft", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              entityType: `MAPPING_${operation}`,
              stableId: `${answerStableId}:${moduleStableId}`,
              expectedUpdatedAt: draft.updatedAt,
              values: operation === "DELETE" ? {} : { weight },
            }),
          });
          return { ok: response.ok, result: await response.json() as { error?: string } };
        })();
      if (!update.ok) {
        setMessage(mappingErrorMessage(update.result.error));
        return false;
      }
      setMessage(
        operation === "CREATE"
          ? "Связь добавлена в DRAFT."
          : operation === "UPDATE"
            ? "Weight обновлён в DRAFT."
            : "Связь удалена из DRAFT.",
      );
      await onReload();
      return true;
    } catch {
      setMessage("Не удалось связаться с сервером. Проверьте соединение и попробуйте снова.");
      return false;
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <section className="admin-mapping-manager" aria-labelledby={`mapping-title-${answerStableId}`}>
      <div className="admin-mapping-manager__heading">
        <div>
          <h3 id={`mapping-title-${answerStableId}`}>Влияет на модули</h3>
          <p>Связи определяют вклад выбранного ответа в score модулей.</p>
        </div>
        <strong>{linked.length}</strong>
      </div>
      {linked.length === 0 ? (
        <p className="admin-mapping-empty">У ответа пока нет mappings. Это допустимое состояние.</p>
      ) : (
        <div className="admin-mapping-links">
          {linked.map((mapping) => {
            const careerModule = modules.find(
              (candidate) => candidate.stableId === mapping.moduleStableId,
            );
            const moduleStableId = String(mapping.moduleStableId);
            return (
              <article className="admin-mapping-link" key={moduleStableId}>
                <div className="admin-mapping-link__identity">
                  <strong>{moduleStableId} · {String(careerModule?.name ?? "Модуль не найден")}</strong>
                  {careerModule?.active === false ? <span>Модуль отключён</span> : null}
                </div>
                {role === "ADMIN" ? (
                  <RelationNumberControl
                    label="Weight"
                    value={Number(mapping.weight)}
                    min={-10}
                    max={10}
                    pending={pendingKey !== null}
                    onSave={(weight) => void mutateMapping("UPDATE", moduleStableId, weight)}
                    onDelete={() => void mutateMapping("DELETE", moduleStableId, null)}
                  />
                ) : (
                  <p className="admin-mapping-link__weight">Weight: <strong>{String(mapping.weight)}</strong></p>
                )}
              </article>
            );
          })}
        </div>
      )}
      {role === "ADMIN" ? (
        availableModules.length ? (
          <form
            className="admin-mapping-create"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              const created = await mutateMapping(
                "CREATE",
                String(data.get("moduleStableId")),
                Number(data.get("weight")),
              );
              if (created) form.reset();
            }}
          >
            <h4>Добавить связь</h4>
            <label>
              Module
              <select name="moduleStableId" required>
                {availableModules.map((careerModule) => (
                  <option key={String(careerModule.stableId)} value={String(careerModule.stableId)}>
                    {String(careerModule.stableId)} · {String(careerModule.name)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Weight
              <input name="weight" type="number" min="-10" max="10" step="1" defaultValue="1" required />
            </label>
            <button className="button-primary" disabled={pendingKey !== null}>Добавить</button>
          </form>
        ) : (
          <p className="admin-hint">Нет доступных совместимых модулей для новой связи.</p>
        )
      ) : (
        <p className="admin-hint">Mappings доступны EDITOR только для просмотра.</p>
      )}
      {message ? <p className="admin-mapping-message" role="status" aria-live="polite">{message}</p> : null}
    </section>
  );
}

function moduleRecommendationErrorMessage(code: string | undefined) {
  const messages: Record<string, string> = {
    MODULE_RECOMMENDATION_ALREADY_EXISTS: "Эта рекомендация уже связана с модулем.",
    MODULE_RECOMMENDATION_NOT_FOUND: "Связь уже удалена или не существует. Обновите страницу.",
    MODULE_RECOMMENDATION_AUDIENCE_INCOMPATIBLE: "Аудитории модуля и рекомендации не пересекаются.",
    MODULE_NOT_FOUND: "Модуль больше не существует. Обновите страницу.",
    RECOMMENDATION_NOT_FOUND: "Рекомендация больше не существует. Обновите страницу.",
    INVALID_DRAFT_MUTATION: "Priority должен быть положительным целым числом.",
    DRAFT_MUTATION_INVALID_CONFIG: "Изменение нарушает целостность DRAFT-конфигурации.",
    DRAFT_STALE_REVISION: "DRAFT изменён другим пользователем. Обновите страницу.",
    ADMIN_FORBIDDEN: "Изменять связи рекомендаций может только ADMIN.",
    ADMIN_UNAUTHENTICATED: "Сессия завершена. Войдите в админку снова.",
    ADMIN_OPERATION_FAILED: "Изменение не прошло серверную проверку DRAFT-конфигурации.",
  };
  return messages[code ?? ""] ?? "Не удалось изменить связь. Обновите страницу и попробуйте снова.";
}

function ModuleRecommendations({
  careerModule,
  draft,
  role,
  onReload,
}: {
  careerModule: Json;
  draft: Draft;
  role: "ADMIN" | "EDITOR";
  onReload: () => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const recommendations = draft.snapshot.recommendations as Json[];
  const links = draft.snapshot.moduleRecommendations as Json[];
  const moduleStableId = String(careerModule.stableId);
  const linked = links.filter((link) => link.moduleStableId === moduleStableId);
  const linkedRecommendationIds = new Set(
    linked.map((link) => link.recommendationStableId),
  );
  const availableRecommendations = recommendations.filter(
    (recommendation) =>
      !linkedRecommendationIds.has(recommendation.stableId) &&
      audiencesIntersect(careerModule, recommendation),
  );

  async function mutateLink(
    operation: "CREATE" | "UPDATE" | "DELETE",
    recommendationStableId: string,
    priority: number | null,
  ) {
    const recommendation = recommendations.find(
      (candidate) => candidate.stableId === recommendationStableId,
    );
    const recommendationLabel = `${String(recommendation?.title ?? "Рекомендация")} · ${recommendationStableId}`;
    const confirmation = operation === "DELETE"
      ? `Удалить только связь модуля ${moduleStableId} с «${recommendationLabel}»? Модуль и рекомендация останутся без изменений.`
      : operation === "CREATE"
        ? `Добавить рекомендацию «${recommendationLabel}» с priority ${priority}?`
        : `Изменить priority рекомендации «${recommendationLabel}» на ${priority}?`;
    if (!window.confirm(confirmation)) return false;

    setPendingKey(`${operation}:${recommendationStableId}`);
    setMessage("");
    try {
      const update = operation === "UPDATE"
        ? await patchRelationUpdate({
          entityType: "MODULE_RECOMMENDATION_UPDATE",
          stableId: `${moduleStableId}:${recommendationStableId}`,
          expectedUpdatedAt: draft.updatedAt,
          valueName: "priority",
          value: Number(priority),
        })
        : await (async () => {
          const response = await fetch("/api/admin/draft", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              entityType: `MODULE_RECOMMENDATION_${operation}`,
              stableId: `${moduleStableId}:${recommendationStableId}`,
              expectedUpdatedAt: draft.updatedAt,
              values: operation === "DELETE" ? {} : { priority },
            }),
          });
          return { ok: response.ok, result: await response.json() as { error?: string } };
        })();
      if (!update.ok) {
        setMessage(moduleRecommendationErrorMessage(update.result.error));
        return false;
      }
      setMessage(
        operation === "CREATE"
          ? "Рекомендация добавлена в DRAFT."
          : operation === "UPDATE"
            ? "Priority обновлён в DRAFT."
            : "Связь удалена из DRAFT.",
      );
      await onReload();
      return true;
    } catch {
      setMessage("Не удалось связаться с сервером. Проверьте соединение и попробуйте снова.");
      return false;
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <section className="admin-mapping-manager" aria-labelledby={`recommendations-title-${moduleStableId}`}>
      <div className="admin-mapping-manager__heading">
        <div>
          <h3 id={`recommendations-title-${moduleStableId}`}>Рекомендации модуля</h3>
          <p>Связи определяют рекомендации, доступные для этого модуля.</p>
        </div>
        <strong>{linked.length}</strong>
      </div>
      {linked.length === 0 ? (
        <p className="admin-mapping-empty">У модуля пока нет рекомендаций.</p>
      ) : (
        <div className="admin-mapping-links">
          {linked.map((link) => {
            const recommendationStableId = String(link.recommendationStableId);
            const recommendation = recommendations.find(
              (candidate) => candidate.stableId === recommendationStableId,
            );
            return (
              <article className="admin-mapping-link" key={recommendationStableId}>
                <div className="admin-mapping-link__identity">
                  <strong>{String(recommendation?.title ?? "Рекомендация не найдена")}</strong>
                  <span>{recommendationStableId}</span>
                  <span>Status: {String(recommendation?.status ?? "—")} · Active: {recommendation?.active === true ? "да" : "нет"}</span>
                </div>
                {role === "ADMIN" ? (
                  <RelationNumberControl
                    label="Priority"
                    value={Number(link.priority)}
                    min={1}
                    pending={pendingKey !== null}
                    onSave={(priority) => void mutateLink("UPDATE", recommendationStableId, priority)}
                    onDelete={() => void mutateLink("DELETE", recommendationStableId, null)}
                  />
                ) : (
                  <p className="admin-mapping-link__weight">Priority: <strong>{String(link.priority)}</strong></p>
                )}
              </article>
            );
          })}
        </div>
      )}
      {role === "ADMIN" ? (
        availableRecommendations.length ? (
          <form
            className="admin-mapping-create"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              const created = await mutateLink(
                "CREATE",
                String(data.get("recommendationStableId")),
                Number(data.get("priority")),
              );
              if (created) form.reset();
            }}
          >
            <h4>Добавить рекомендацию</h4>
            <label>
              Recommendation
              <select name="recommendationStableId" required>
                {availableRecommendations.map((recommendation) => (
                  <option key={String(recommendation.stableId)} value={String(recommendation.stableId)}>
                    {String(recommendation.title)} · {String(recommendation.stableId)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Priority
              <input name="priority" type="number" min="1" step="1" defaultValue="1" required />
            </label>
            <button className="button-primary" disabled={pendingKey !== null}>Добавить</button>
          </form>
        ) : (
          <p className="admin-hint">Нет доступных совместимых рекомендаций для новой связи.</p>
        )
      ) : (
        <p className="admin-hint">Связи рекомендаций доступны EDITOR только для просмотра.</p>
      )}
      {message ? <p className="admin-mapping-message" role="status" aria-live="polite">{message}</p> : null}
    </section>
  );
}

function RecommendationUsage({ recommendation, draft }: { recommendation: Json; draft: Draft }) {
  const modules = draft.snapshot.modules as Json[];
  const links = draft.snapshot.moduleRecommendations as Json[];
  const recommendationStableId = String(recommendation.stableId);
  const usedBy = links
    .filter((link) => link.recommendationStableId === recommendationStableId)
    .map((link) => ({
      link,
      careerModule: modules.find((candidate) => candidate.stableId === link.moduleStableId),
    }));

  return (
    <section className="admin-mapping-manager" aria-labelledby={`usage-title-${recommendationStableId}`}>
      <div className="admin-mapping-manager__heading">
        <div>
          <h3 id={`usage-title-${recommendationStableId}`}>Используется в {usedBy.length} модулях</h3>
          <p>Список формируется из текущего DRAFT и доступен только для просмотра.</p>
        </div>
      </div>
      {usedBy.length ? (
        <div className="admin-mapping-links">
          {usedBy.map(({ link, careerModule }) => (
            <article className="admin-mapping-link" key={String(link.moduleStableId)}>
              <div className="admin-mapping-link__identity">
                <strong>{String(careerModule?.name ?? "Модуль не найден")}</strong>
                <span>{String(link.moduleStableId)} · Priority: {String(link.priority)}</span>
              </div>
            </article>
          ))}
        </div>
      ) : <p className="admin-mapping-empty">Рекомендация пока не связана с модулями.</p>}
    </section>
  );
}

type TypedLeaf = { path: string[]; value: string | number | boolean | null };

function typedLeaves(input: unknown, path: string[] = []): TypedLeaf[] {
  if (input === null || ["string", "number", "boolean"].includes(typeof input)) {
    return [{ path, value: input as TypedLeaf["value"] }];
  }
  if (Array.isArray(input)) return input.flatMap((value, index) => typedLeaves(value, [...path, String(index)]));
  if (typeof input === "object") return Object.entries(input as Json).flatMap(([key, value]) => typedLeaves(value, [...path, key]));
  return [];
}

function typedFormName(prefix: string, path: string[]) {
  return `${prefix}:${path.join("/")}`;
}

function typedFormValue(form: FormData, prefix: string, original: unknown) {
  const copy = structuredClone(original);
  for (const leaf of typedLeaves(original)) {
    const raw = form.get(typedFormName(prefix, leaf.path));
    let value: TypedLeaf["value"];
    if (typeof leaf.value === "boolean") value = raw === "true";
    else if (typeof leaf.value === "number") value = Number(raw);
    else if (leaf.value === null) value = raw ? String(raw) : null;
    else value = String(raw ?? "");
    let cursor = copy as Json | unknown[];
    leaf.path.forEach((part, index) => {
      if (index === leaf.path.length - 1) (cursor as Json)[part] = value;
      else cursor = (cursor as Json)[part] as Json | unknown[];
    });
  }
  return copy;
}

function TypedFields({ prefix, value }: { prefix: string; value: unknown }) {
  return <fieldset><legend>{prefix === "params" ? "Typed params" : "Human effect"}</legend>{typedLeaves(value).map((leaf) => <label key={`${prefix}-${leaf.path.join("-")}`}>{leaf.path.join(" › ")}{typeof leaf.value === "boolean" ? <select name={typedFormName(prefix, leaf.path)} defaultValue={String(leaf.value)}><option value="true">true</option><option value="false">false</option></select> : <input name={typedFormName(prefix, leaf.path)} type={typeof leaf.value === "number" ? "number" : "text"} defaultValue={leaf.value ?? ""} />}</label>)}</fieldset>;
}

function CreateEntityForm({ entityType, draft, onCreated }: { entityType: string; draft: Draft; onCreated: () => Promise<void> }) {
  const [message, setMessage] = useState("");
  if (!(["QUESTION", "ANSWER", "RECOMMENDATION"].includes(entityType))) return null;
  const questions = draft.snapshot.questions as Json[];

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const common = { stableId: form.get("stableId"), expectedUpdatedAt: draft.updatedAt };
    const lists = {
      tags: String(form.get("tags") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
      keys: String(form.get("keys") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    };
    const payload = entityType === "QUESTION" ? {
      entityType: "QUESTION_CREATE", ...common,
      values: {
        block: form.get("block"), text: form.get("text"), selectionType: form.get("selectionType"),
        minSelect: Number(form.get("minSelect")), maxSelect: Number(form.get("maxSelect")),
        required: form.get("required") === "on", sortOrder: Number(form.get("sortOrder")),
        showCondition: form.get("showCondition") === "ENTREPRENEUR_SIGNAL" ? { expression: "entrepreneur_signal = true" } : null,
        forBachelor: form.get("forBachelor") === "on", forMaster: form.get("forMaster") === "on",
        firstAnswer: { stableId: form.get("firstAnswerStableId"), text: form.get("firstAnswerText") },
      },
    } : entityType === "ANSWER" ? {
      entityType: "ANSWER_CREATE", ...common,
      values: {
        questionStableId: form.get("questionStableId"), text: form.get("text"),
        sortOrder: Number(form.get("sortOrder")), tags: lists.tags, keys: lists.keys, active: true,
      },
    } : {
      entityType: "RECOMMENDATION_CREATE", ...common,
      values: {
        type: form.get("type"), title: form.get("title"), description: form.get("description"),
        url: form.get("url") || null, status: form.get("status"), tags: lists.tags,
        priorityTags: String(form.get("priorityTags") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
        active: true, forBachelor: form.get("forBachelor") === "on", forMaster: form.get("forMaster") === "on",
      },
    };
    const response = await fetch("/api/admin/draft", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json() as { error?: string };
    setMessage(response.ok ? "Создано в DRAFT." : result.error ?? "Не удалось создать запись.");
    if (response.ok) { event.currentTarget.reset(); await onCreated(); }
  }

  const title = entityType === "QUESTION" ? "вопрос вместе с первым ответом" : entityType === "ANSWER" ? "ответ" : "рекомендацию";
  return <details className="admin-card"><summary>Создать {title}</summary><form className="admin-form" onSubmit={create}>
    <label>Stable ID<input name="stableId" pattern={entityType === "QUESTION" ? "Q[0-9]+" : entityType === "ANSWER" ? "Q[0-9]+_A[0-9]+" : "[A-Z][A-Z0-9_]*"} required /></label>
    {entityType === "QUESTION" && <>
      <label>Блок<input name="block" required /></label><label>Текст<textarea name="text" required /></label>
      <label>Тип<select name="selectionType"><option>SINGLE</option><option>MULTI</option></select></label>
      <label>Min select<input name="minSelect" type="number" min="0" defaultValue="1" required /></label>
      <label>Max select<input name="maxSelect" type="number" min="1" defaultValue="1" required /></label>
      <label>Sort order<input name="sortOrder" type="number" min="1" defaultValue={questions.length + 1} required /></label>
      <label className="admin-checkbox"><input name="required" type="checkbox" defaultChecked /> required</label>
      <label>Условие показа<select name="showCondition"><option value="ALWAYS">Показывать всегда</option><option value="ENTREPRENEUR_SIGNAL">Только при entrepreneur_signal</option></select></label>
      <label>ID первого ответа<input name="firstAnswerStableId" pattern="Q[0-9]+_A[0-9]+" required /></label>
      <label>Текст первого ответа<input name="firstAnswerText" required /></label>
    </>}
    {entityType === "ANSWER" && <>
      <label>Вопрос<select name="questionStableId">{questions.map((question) => <option key={String(question.stableId)}>{String(question.stableId)}</option>)}</select></label>
      <label>Текст<input name="text" required /></label><label>Sort order<input name="sortOrder" type="number" min="1" required /></label>
      <label>Tags <small>через запятую</small><input name="tags" /></label><label>Keys <small>через запятую</small><input name="keys" /></label>
    </>}
    {entityType === "RECOMMENDATION" && <>
      <label>Тип<select name="type"><option>CKO_SERVICE</option><option>EVENT</option><option>CLUB</option><option>FACULTY</option><option>GENERAL</option></select></label>
      <label>Название<input name="title" required /></label><label>Описание<textarea name="description" required /></label>
      <label>URL<input name="url" type="url" /></label><label>Статус<select name="status"><option>ACTIVE</option><option>SLOT</option><option>INACTIVE</option></select></label>
      <label>Tags <small>через запятую</small><input name="tags" /></label><label>Priority tags <small>через запятую</small><input name="priorityTags" /></label>
    </>}
    {["QUESTION", "RECOMMENDATION"].includes(entityType) && <fieldset><legend>Для кого</legend><label className="admin-checkbox"><input name="forBachelor" type="checkbox" /> Бакалавриат</label><label className="admin-checkbox"><input name="forMaster" type="checkbox" defaultChecked /> Магистратура</label></fieldset>}
    <button className="button-primary">Создать</button>{message && <p role="status">{message}</p>}
  </form></details>;
}

function EntitySection({ section, role }: { section: string; role: "ADMIN" | "EDITOR" }) {
  const config = sectionConfig[section];
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [message, setMessage] = useState("");
  async function load() { setDraft(await fetch("/api/admin/draft").then((r) => r.json())); }
  useEffect(() => {
    void fetch("/api/admin/draft").then((response) => response.json()).then(setDraft);
  }, [section]);
  const items = useMemo(() => (draft?.snapshot[config.key] as Json[] | undefined) ?? [], [draft, config.key]);
  const structuralCounters = useMemo(() => buildStructuralCounters(draft?.snapshot ?? {}), [draft]);
  const raw = items[selectedIndex] ?? items[0];
  const item = raw ? normalizeItem(config.entityType, raw) : null;
  const logicLocked = role !== "ADMIN" && ["WEIGHT", "RULE", "MODIFIER"].includes(config.entityType);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !item) return;
    const form = new FormData(event.currentTarget);
    const values: Json = {};
    for (const field of valueFields(config.entityType)) {
      const current = item[field];
      if (typeof current === "boolean") values[field] = form.get(field) === "on";
      else if (typeof current === "number") values[field] = Number(form.get(field));
      else if (Array.isArray(current)) values[field] = String(form.get(field) ?? "").split(",").map((value) => value.trim()).filter(Boolean);
      else values[field] = form.get(field) || null;
    }
    if (config.entityType === "QUESTION") {
      values.showCondition = form.get("showCondition") === "ENTREPRENEUR_SIGNAL"
        ? { expression: "entrepreneur_signal = true" }
        : null;
    }
    if (config.entityType === "RULE") values.params = typedFormValue(form, "params", item.params);
    if (config.entityType === "MODIFIER") {
      values.effect = typedFormValue(form, "effect", item.effect);
      values.operationParams = typedFormValue(form, "params", (item.operation as Json).params);
    }
    if (["RULE", "MODIFIER", "WEIGHT"].includes(config.entityType) && !window.confirm("Сохранить изменение критической карьерной логики в DRAFT?")) return;
    const stableId = config.entityType === "WEIGHT" ? `${String(item.answerStableId)}:${String(item.moduleStableId)}` : String(item.stableId);
    const entityType = config.entityType === "WEIGHT" ? "MAPPING_UPDATE" : config.entityType;
    const response = await fetch("/api/admin/draft", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ entityType, stableId, expectedUpdatedAt: draft.updatedAt, values }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setMessage(config.entityType === "WEIGHT" ? mappingErrorMessage(result.error) : result.error === "DRAFT_STALE_REVISION" ? "Данные изменены другим пользователем. Обновите страницу." : result.error ?? "Не удалось сохранить"); return; }
    setMessage("Сохранено");
    await load();
  }

  async function createOpportunity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/draft", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entityType: "OPPORTUNITY",
        stableId: form.get("stableId"),
        expectedUpdatedAt: draft.updatedAt,
        values: {
          type: form.get("type"),
          title: form.get("title"),
          description: form.get("description"),
          url: form.get("url") || null,
          tags: [],
          active: true,
        },
      }),
    });
    setMessage(response.ok ? "Возможность создана" : "Не удалось создать возможность");
    if (response.ok) await load();
  }

  if (!draft) return <p>Загрузка…</p>;
  const hasAudience = ["QUESTION", "MODULE", "RECOMMENDATION"].includes(config.entityType);
  const editorKey = item
    ? `${config.entityType}:${String(item.stableId ?? `${item.answerStableId}:${item.moduleStableId}`)}`
    : `${config.entityType}:empty`;
  const answers = draft.snapshot.answers as Json[];
  const modules = draft.snapshot.modules as Json[];
  const answerById = new Map(answers.map((answer) => [String(answer.stableId), answer]));
  const moduleById = new Map(modules.map((careerModule) => [String(careerModule.stableId), careerModule]));
  const hasRelationPanel = ["ANSWER", "MODULE", "RECOMMENDATION"].includes(config.entityType);
  return <>
    <header className="admin-heading">
      <div><p className="eyebrow">DRAFT only</p><h1>{config.title}</h1></div>
      <span className={draft.validation.valid ? "admin-status" : "admin-status admin-status--error"}>{draft.validation.valid ? "Готово" : "Есть ошибки"}</span>
    </header>
    <CreateEntityForm entityType={config.entityType} draft={draft} onCreated={load} />
    <div className="admin-editor">
      <div className="admin-list">
        {items.map((candidate, index) => {
          const isMapping = config.entityType === "WEIGHT";
          const answer = isMapping ? answerById.get(String(candidate.answerStableId)) : null;
          const careerModule = isMapping ? moduleById.get(String(candidate.moduleStableId)) : null;
          const counter = isMapping ? "" : structuralCounterLabel(config.entityType, String(candidate.stableId), structuralCounters);
          return <button key={`${String(candidate.stableId ?? index)}`} onClick={() => setSelectedIndex(index)} className={index === selectedIndex ? "active" : ""}>
            <strong>{isMapping ? `${String(candidate.answerStableId)} · ${String(answer?.text ?? "Ответ не найден")}` : String(candidate.stableId ?? candidate.answerStableId)}</strong>
            <span>{isMapping ? `→ ${String(candidate.moduleStableId)} · ${String(careerModule?.name ?? "Модуль не найден")}` : String(candidate.title ?? candidate.name ?? candidate.text ?? candidate.moduleStableId ?? "")}</span>
            {isMapping ? <small>Weight: {String(candidate.weight)}</small> : hasAudience ? <small>{audienceLabel(candidate)}</small> : null}
            {counter ? <small>{counter}</small> : null}
          </button>;
        })}
      </div>
      <section className="admin-card">
        {!item && config.entityType === "OPPORTUNITY" ? (
          <form className="admin-form" onSubmit={createOpportunity}>
            <h2>Новая возможность</h2>
            <label>Stable ID<input name="stableId" pattern="[A-Z][A-Z0-9_]*" required /></label>
            <label>Тип<select name="type"><option>EVENT</option><option>CLUB</option><option>FACULTY</option><option>PRACTICE</option><option>INTERNSHIP</option><option>OTHER</option></select></label>
            <label>Название<input name="title" required /></label>
            <label>Описание<textarea name="description" required /></label>
            <label>URL<input name="url" type="url" /></label>
            <button className="button-primary">Создать в DRAFT</button>{message && <p>{message}</p>}
          </form>
        ) : !item ? <p>Записей пока нет.</p> : <>
          {hasRelationPanel ? <h2>{String(item.stableId)}</h2> : null}
          {config.entityType === "ANSWER" ? (
            <AnswerMappings key={String(item.stableId)} answer={item} draft={draft} role={role} onReload={load} />
          ) : null}
          {config.entityType === "MODULE" ? (
            <ModuleRecommendations key={String(item.stableId)} careerModule={item} draft={draft} role={role} onReload={load} />
          ) : null}
          {config.entityType === "RECOMMENDATION" ? (
            <RecommendationUsage key={String(item.stableId)} recommendation={item} draft={draft} />
          ) : null}
          <form key={editorKey} onSubmit={save} className="admin-form">
            {!hasRelationPanel ? <h2>{String(item.stableId ?? item.answerStableId)}</h2> : null}
            {config.entityType === "WEIGHT" ? <div className="admin-mapping-summary">
              <p><strong>{String(item.answerStableId)} · {String(answerById.get(String(item.answerStableId))?.text ?? "Ответ не найден")}</strong></p>
              <p>→ {String(item.moduleStableId)} · {String(moduleById.get(String(item.moduleStableId))?.name ?? "Модуль не найден")}</p>
            </div> : null}
            {hasAudience ? <fieldset><legend>Для кого</legend><label className="admin-checkbox"><input name="forBachelor" type="checkbox" defaultChecked={Boolean(item.forBachelor)} /> Бакалавриат</label><label className="admin-checkbox"><input name="forMaster" type="checkbox" defaultChecked={Boolean(item.forMaster)} /> Магистратура</label></fieldset> : null}
            {valueFields(config.entityType).filter((field) => !["forBachelor", "forMaster"].includes(field)).map((field) => typeof item[field] === "boolean" ? <label key={field} className="admin-checkbox"><input name={field} type="checkbox" defaultChecked={Boolean(item[field])} /> {field}</label> : field === "weight" ? <label key={field}>Weight<input name={field} type="number" min="-10" max="10" step="1" defaultValue={Number(item[field])} required disabled={logicLocked} /></label> : <label key={field}>{field}{Array.isArray(item[field]) && <small>через запятую</small>}<textarea name={field} defaultValue={Array.isArray(item[field]) ? (item[field] as unknown[]).join(", ") : String(item[field] ?? "")} rows={["description", "goal", "sourceContent"].includes(field) ? 5 : 2} /></label>)}
            {config.entityType === "QUESTION" && <label>Условие показа<select name="showCondition" defaultValue={item.showCondition ? "ENTREPRENEUR_SIGNAL" : "ALWAYS"}><option value="ALWAYS">Показывать всегда</option><option value="ENTREPRENEUR_SIGNAL">Только при entrepreneur_signal</option></select></label>}
            {config.entityType === "RULE" && <TypedFields prefix="params" value={item.params} />}
            {config.entityType === "MODIFIER" && <><TypedFields prefix="effect" value={item.effect} /><TypedFields prefix="params" value={(item.operation as Json).params} /></>}
            {["RULE", "MODIFIER"].includes(config.entityType) && <details><summary>Typed JSON preview (read-only)</summary><pre>{JSON.stringify(item.params ?? item.operation, null, 2)}</pre></details>}
            {["RULE", "MODIFIER", "WEIGHT"].includes(config.entityType) && <p className="admin-hint">Критическая логика. Изменения доступны только ADMIN и проходят полную typed validation.</p>}
            <button className="button-primary" disabled={logicLocked}>Сохранить</button>
            {logicLocked && <p className="admin-hint">Критическая логика доступна только ADMIN.</p>}
            {message && <p role="status">{message}</p>}
          </form>
        </>}
      </section>
    </div>
  </>;
}

const relationKindLabels: Record<RelationEntityKind, string> = {
  QUESTION: "Вопрос",
  ANSWER: "Ответ",
  MODULE: "Модуль",
  RECOMMENDATION: "Рекомендация",
};

function RelationEntitySummary({ entity, focused = false }: { entity: RelationEntity; focused?: boolean }) {
  return (
    <div className={focused ? "admin-relation-node admin-relation-node--focus" : "admin-relation-node"}>
      <small>{relationKindLabels[entity.kind]}</small>
      <strong>{entity.label}</strong>
      <span>{entity.stableId}</span>
      <div className="admin-relation-node__meta">
        <em>{entity.audience}</em>
        <em className={entity.active ? "is-active" : "is-inactive"}>{entity.active ? "active" : "inactive"}</em>
        {entity.status ? <em>{entity.status}</em> : null}
      </div>
    </div>
  );
}

function RelationMap() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [query, setQuery] = useState("");
  const [focusKey, setFocusKey] = useState("");
  useEffect(() => { void fetch("/api/admin/draft").then((response) => response.json()).then(setDraft); }, []);

  const options = useMemo(() => draft ? buildRelationFocusOptions(draft.snapshot) : [], [draft]);
  const counters = useMemo(() => draft ? buildStructuralCounters(draft.snapshot) : null, [draft]);
  const selected = options.find((option) => `${option.kind}:${option.stableId}` === focusKey) ?? options.find((option) => option.kind === "MODULE") ?? options[0];
  const model = useMemo(() => draft && selected ? buildRelationMapModel(draft.snapshot, selected) : null, [draft, selected]);
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");
  const filteredOptions = options.filter((option) => !normalizedQuery || `${relationKindLabels[option.kind]} ${option.stableId} ${option.label}`.toLocaleLowerCase("ru").includes(normalizedQuery));
  const answerIds = new Set(model?.answers.map((answer) => answer.stableId) ?? []);

  if (!draft || !counters) return <p>Загрузка…</p>;

  return <>
    <header className="admin-heading">
      <div><p className="eyebrow">Current DRAFT · read-only</p><h1>Карта связей</h1></div>
      <span className="admin-status">Без изменений</span>
    </header>
    <p className="admin-hint">Выберите одну сущность, чтобы увидеть только её окружение. Редактирование остаётся в разделах «Ответы» и «Модули».</p>
    <div className="admin-relation-layout">
      <aside className="admin-relation-picker">
        <label>Поиск по названию или Stable ID<input type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Например, M01 или выбор направления" /></label>
        <div className="admin-list">
          {filteredOptions.map((option) => {
            const key = `${option.kind}:${option.stableId}`;
            return <button key={key} type="button" className={selected && key === `${selected.kind}:${selected.stableId}` ? "active" : ""} onClick={() => setFocusKey(key)}>
              <small>{relationKindLabels[option.kind]}</small>
              <strong>{option.label}</strong>
              <span>{option.stableId}</span>
              <small>{structuralCounterLabel(option.kind, option.stableId, counters)}</small>
            </button>;
          })}
          {filteredOptions.length === 0 ? <p className="admin-hint">Ничего не найдено.</p> : null}
        </div>
      </aside>
      <section className="admin-card admin-relation-focus">
        {!model ? <p>Связи не найдены.</p> : <>
          <RelationEntitySummary entity={model.focus} focused />
          {model.question && model.focus.kind !== "QUESTION" ? <div className="admin-relation-context"><span>Принадлежит вопросу</span><RelationEntitySummary entity={model.question} /></div> : null}
          {model.focus.kind === "QUESTION" ? <div className="admin-relation-group"><h2>Ответы · {model.answers.length}</h2><div className="admin-relation-items">{model.answers.map((answer) => <RelationEntitySummary key={answer.stableId} entity={answer} />)}</div></div> : null}
          <div className="admin-relation-group">
            <h2>{model.focus.kind === "MODULE" ? "Входящие ответы и рекомендации" : model.focus.kind === "RECOMMENDATION" ? "Использование в модулях" : "Модули и рекомендации"} · {model.modules.length}</h2>
            {model.modules.length === 0 ? <p className="admin-hint">У выбранной сущности пока нет связей на этом уровне.</p> : <div className="admin-relation-modules">{model.modules.map((careerModule) => {
              const incoming = model.focus.kind === "QUESTION" ? careerModule.incomingAnswers.filter((item) => answerIds.has(item.entity.stableId)) : careerModule.incomingAnswers;
              return <article className="admin-relation-module" key={careerModule.entity.stableId}>
                {(model.focus.kind === "MODULE" || model.focus.kind === "RECOMMENDATION" || model.focus.kind === "QUESTION") && incoming.length ? <div className="admin-relation-column"><h3>Входящие ответы</h3>{incoming.map((item) => <div className="admin-relation-link" key={`${item.entity.stableId}:${careerModule.entity.stableId}`}><RelationEntitySummary entity={item.entity} /><b>Weight {item.weight}</b></div>)}</div> : null}
                <div className="admin-relation-column"><h3>Модуль</h3><RelationEntitySummary entity={careerModule.entity} />{careerModule.weight !== undefined && Number.isFinite(careerModule.weight) ? <b>Weight {careerModule.weight}</b> : null}</div>
                <div className="admin-relation-column"><h3>Рекомендации</h3>{careerModule.recommendations.length ? careerModule.recommendations.map((item) => <div className="admin-relation-link" key={item.entity.stableId}><RelationEntitySummary entity={item.entity} /><b>Priority {item.priority}</b></div>) : <p className="admin-hint">Нет рекомендаций.</p>}</div>
              </article>;
            })}</div>}
          </div>
        </>}
      </section>
    </div>
  </>;
}

type PreviewCalculation = {
  result: TrajectoryResult;
  debug: TrajectoryDebug;
  explanation: AdminPreviewExplanation;
};

function PreviewResult({ calculation }: { calculation: PreviewCalculation }) {
  const { result } = calculation;
  return <section className="admin-card admin-preview-result">
    <p className="eyebrow">Public-style result</p>
    <h2>{result.primaryModule.name}</h2>
    <p>{result.primaryModule.goal}</p>
    {result.supportModules.length ? <p><strong>Support:</strong> {result.supportModules.map((item) => `${item.name} · ${item.id}`).join(", ")}</p> : <p>Support-модули не выбраны.</p>}
    <ol>{result.steps.map((step) => <li key={step}>{step}</li>)}</ol>
    {result.adjustments.length ? <><h3>Корректировки</h3><ul>{result.adjustments.map((item) => <li key={item}>{item}</li>)}</ul></> : null}
    <h3>Рекомендации</h3>
    <ul>{result.recommendations.map((item) => <li key={item.id}><strong>{item.title}</strong> <small>{item.id}</small></li>)}</ul>
  </section>;
}

function PreviewDebugger({ calculation }: { calculation: PreviewCalculation }) {
  const { explanation, debug } = calculation;
  return <section className="admin-preview-debugger">
    <header><p className="eyebrow">Фактический debug Rule Engine</p><h2>Почему такой результат?</h2></header>
    <section className="admin-card"><h3>Ranking модулей</h3><ol className="admin-debug-ranking">{explanation.ranking.map((item) => <li key={item.moduleId}><div><strong>{item.name}</strong><small>{item.moduleId} · {item.role}</small></div><b>{item.score}</b><p>{item.reason}</p></li>)}</ol><p className="admin-hint">Support threshold: {explanation.supportThreshold} · максимум support: {explanation.maxSupportCount}</p></section>
    <section className="admin-card"><h3>Score breakdown</h3><div className="admin-debug-grid">{explanation.scoreBreakdown.map((item) => <article key={item.moduleId}><h4>{item.name} <small>{item.moduleId}</small></h4>{item.contributions.length ? <ul>{item.contributions.map((entry, index) => <li key={`${entry.answerId}:${index}`}><span>{entry.answerText} <small>{entry.answerId}</small></span><b>{entry.weight >= 0 ? "+" : ""}{entry.weight}</b></li>)}</ul> : <p className="admin-hint">Нет score-вкладов.</p>}<strong>TOTAL = {item.total}</strong></article>)}</div></section>
    <section className="admin-card"><h3>Tie-break</h3>{explanation.tieBreaks.length ? explanation.tieBreaks.map((tie) => <article className="admin-debug-block" key={`${tie.total}:${tie.moduleIds.join(":")}`}><p><strong>TOTAL equal: {tie.total}</strong> · {tie.moduleIds.join(" / ")}</p><ol>{tie.steps.map((step) => <li key={step.criterion}>{step.criterion}: {step.values.map((value) => `${value.moduleId}=${value.value}`).join(", ")}</li>)}</ol><p>Победитель: <strong>{tie.winnerModuleId}</strong>. Решающий этап: <strong>{tie.decidedBy}</strong>.</p></article>) : <p>Одинаковых TOTAL в текущем ranking нет.</p>}</section>
    <div className="admin-grid">
      <section className="admin-card"><h3>Guards и fallback</h3>{explanation.guards.map((guard) => <p key={guard.ruleId}><strong>{guard.moduleName} · {guard.moduleId}</strong><br />{guard.excluded ? "Исключён" : "Допущен"}: {guard.condition}</p>)}{explanation.fallback ? <div className="admin-debug-notice"><strong>Fallback сработал</strong><p>Обычный ranking не достиг threshold. Выбран {explanation.fallback.selectedModuleName} · {explanation.fallback.selectedModuleId}.</p><p>Условие: {explanation.fallback.condition}</p></div> : <p>Fallback не применялся.</p>}</section>
      <section className="admin-card"><h3>Modifiers</h3>{explanation.modifiers.length ? explanation.modifiers.map((modifier) => <p key={modifier.id}><strong>{modifier.id}</strong> · {modifier.operationKind}<br />Цель: {modifier.targetModuleName}<br />Триггер: {modifier.triggerAnswers.map((answer) => `${answer.text} · ${answer.id}`).join(", ") || "системное условие"}<br />Изменение: {modifier.change}</p>) : <p>Модификаторы не применялись.</p>}</section>
    </div>
    <section className="admin-card"><h3>Q6 / Q7 / Q8 и предпринимательство</h3><div className="admin-debug-grid"><article><h4>Q6 · Приоритеты</h4>{explanation.selections.priorities.length ? explanation.selections.priorities.map((item) => <p key={item.id}>{item.text} <small>{item.id}</small></p>) : <p>Не выбраны.</p>}</article><article><h4>Q7 · Темп</h4>{explanation.selections.pace.answers.map((item) => <p key={item.id}>{item.text} <small>{item.id}</small></p>)}<p>{explanation.selections.pace.result?.text ?? "Темп не применён."}</p></article><article><h4>Q8 · Формат поддержки</h4>{explanation.selections.preferences.length ? explanation.selections.preferences.map((item) => <p key={item.id}>{item.text} <small>{item.id}</small></p>) : <p>Предпочтения не выбраны.</p>}</article><article><h4>Предпринимательство</h4><p>entrepreneur_signal: {explanation.entrepreneurship.active ? "да" : "нет"}</p><p>Стадия: {explanation.entrepreneurship.stage ? `${explanation.entrepreneurship.stage.focus} · ${explanation.entrepreneurship.stage.id}` : "—"}</p><p>Challenges: {explanation.entrepreneurship.challengeIds.join(", ") || "—"}</p>{explanation.entrepreneurship.ignoredAnswerIds.length ? <p>Игнорированы скрытые ответы: {explanation.entrepreneurship.ignoredAnswerIds.join(", ")}</p> : null}</article></div></section>
    <section className="admin-card"><h3>Recommendations</h3><div className="admin-debug-grid">{explanation.recommendations.map((item) => <article key={item.id}><h4>{item.title}</h4><p><small>{item.id} · source: {item.source.toLowerCase()}</small></p><p>Модуль: {item.moduleName ?? "special"} · link priority: {item.linkPriority}</p><p>Q6 boost: {item.priorityTagBoost ? "да" : "нет"} · Q8 preference: {item.preferenceBoost ? "да" : "нет"}</p><p>Special boost: {item.challengeBoost ? "да" : "нет"} · Opportunity resolution: {item.opportunityResolved ? "да" : "нет"}</p></article>)}</div>{explanation.recommendationExclusions.length ? <details><summary>Не выбранные кандидаты</summary><ul>{explanation.recommendationExclusions.map((item) => <li key={item.id}>{item.title} · {item.id}: {item.reason}</li>)}</ul></details> : null}</section>
    <details className="admin-card"><summary>Raw debug JSON</summary><pre>{JSON.stringify(debug, null, 2)}</pre></details>
  </section>;
}

function Preview() {
  const [educationLevel, setEducationLevel] = useState<EducationLevel>("MASTER");
  const [questionnaire, setQuestionnaire] = useState<PublicQuestionnaireDTO | null>(null);
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [answers, setAnswers] = useState<PreviewAnswers>({});
  const [calculation, setCalculation] = useState<PreviewCalculation | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setQuestionnaire(null);
    setAnswers({});
    setCalculation(null);
    setMessage("");
    fetch(`/api/admin/preview?educationLevel=${educationLevel}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("PREVIEW_QUESTIONNAIRE_UNAVAILABLE");
        return response.json() as Promise<{ available: boolean; questionnaire: PublicQuestionnaireDTO | null; message: string | null }>;
      })
      .then((data) => {
        setQuestionnaire(data.questionnaire);
        setAvailabilityMessage(data.message ?? "");
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setAvailabilityMessage("Не удалось загрузить DRAFT-анкету.");
        setLoading(false);
      });
    return () => controller.abort();
  }, [educationLevel]);

  async function run(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!questionnaire || !canCalculatePreview(questionnaire, answers)) return;
    setCalculating(true);
    setMessage("");
    setCalculation(null);
    const response = await fetch("/api/admin/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ selectedAnswerIds: selectedPreviewAnswerIds(questionnaire, answers), educationLevel }),
    });
    const body = await response.json() as PreviewCalculation & { error?: string };
    if (!response.ok) setMessage(body.error === "MIN_SELECT" || body.error === "MAX_SELECT" ? "Проверьте количество ответов в вопросах." : "Не удалось рассчитать DRAFT. Проверьте заполнение анкеты.");
    else setCalculation(body);
    setCalculating(false);
  }

  const visibleQuestions = questionnaire ? visiblePreviewQuestions(questionnaire, answers) : [];
  const valid = questionnaire ? canCalculatePreview(questionnaire, answers) : false;

  return <>
    <header className="admin-heading"><div><p className="eyebrow">Тот же production engine · DRAFT only</p><h1>Preview DRAFT</h1></div><span className="admin-status">Без session</span></header>
    <section className="admin-card admin-preview-level"><h2>Уровень обучения</h2><label><input type="radio" name="preview-education" checked={educationLevel === "BACHELOR"} onChange={() => setEducationLevel("BACHELOR")} /> Бакалавриат</label><label><input type="radio" name="preview-education" checked={educationLevel === "MASTER"} onChange={() => setEducationLevel("MASTER")} /> Магистратура</label></section>
    {loading ? <p>Загрузка анкеты…</p> : !questionnaire ? <section className="admin-card"><h2>Preview недоступен</h2><p>{availabilityMessage}</p></section> : <form onSubmit={run} className="admin-card admin-preview-form"><h2>Анкета DRAFT</h2>{visibleQuestions.map((question) => {
      const selected = answers[question.id] ?? [];
      return <fieldset key={question.id}><legend>{question.title} <small>{question.id}</small></legend><p className="admin-hint">{question.instruction}</p>{question.answers.map((answer) => {
        const checked = selected.includes(answer.id);
        const maxReached = question.type === "multi" && selected.length >= question.maxSelect && !checked;
        return <label key={answer.id}><input type={question.type === "single" ? "radio" : "checkbox"} name={question.type === "single" ? previewRadioGroupName(question.id) : `${previewRadioGroupName(question.id)}-${answer.id}`} checked={checked} disabled={maxReached} onChange={() => setAnswers((current) => updatePreviewAnswer(questionnaire, current, question, answer.id))} /> <span>{answer.text} <small>{answer.id}</small></span></label>;
      })}<small>Выбрано: {selected.length} · min {question.minSelect} · max {question.maxSelect}</small></fieldset>;
    })}<button className="button-primary" disabled={!valid || calculating}>{calculating ? "Рассчитываем…" : "Рассчитать DRAFT"}</button>{!valid ? <p className="admin-hint">Заполните обязательные вопросы и соблюдайте min/max выбора.</p> : null}{message ? <p role="alert">{message}</p> : null}</form>}
    {calculation ? <><PreviewResult calculation={calculation} /><PreviewDebugger calculation={calculation} /></> : null}
  </>;
}

function Audit() {
  const [endpoint, setEndpoint] = useState("/api/admin/audit");
  const [data, setData] = useState<Json | null>(null);
  useEffect(() => { void fetch(endpoint).then((response) => response.json()).then(setData); }, [endpoint]);
  function filter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    new FormData(event.currentTarget).forEach((value, key) => {
      if (!value) return;
      params.set(key, ["from", "to"].includes(key) ? new Date(String(value)).toISOString() : String(value));
    });
    setEndpoint(`/api/admin/audit?${params.toString()}`);
  }
  return <><header className="admin-heading"><h1>Журнал изменений</h1></header><form className="admin-card admin-form" onSubmit={filter}><label>Пользователь<input name="username" /></label><label>Entity type<input name="entityType" /></label><label>Action<input name="action" /></label><label>С даты<input name="from" type="datetime-local" /></label><label>До даты<input name="to" type="datetime-local" /></label><button className="button-secondary">Применить фильтры</button></form><section className="admin-card"><pre>{data ? JSON.stringify(data, null, 2) : "Загрузка…"}</pre></section></>;
}

function Validation() {
  const [draft, setDraft] = useState<Draft | null>(null);
  useEffect(() => { void fetch("/api/admin/draft").then((response) => response.json()).then(setDraft); }, []);
  if (!draft) return <p>Загрузка…</p>;
  const errors = draft.validation.issues.filter((issue) => issue.severity === "ERROR");
  const warnings = draft.validation.issues.filter((issue) => issue.severity === "WARNING");
  return <><header className="admin-heading"><div><p className="eyebrow">Current DRAFT</p><h1>Валидация</h1></div><span className={draft.validation.valid ? "admin-status" : "admin-status admin-status--error"}>{draft.validation.valid ? "Готово к публикации" : "Публикация заблокирована"}</span></header><div className="admin-grid"><article className="admin-card admin-card--metric"><strong>{errors.length}</strong><span>ошибок</span></article><article className="admin-card admin-card--metric"><strong>{warnings.length}</strong><span>предупреждений</span></article></div><section className="admin-card"><h2>Structured issues</h2>{draft.validation.issues.length === 0 ? <p>Схема, ссылки, уникальные ID, R01–R17, модификаторы и ветвления валидны.</p> : <ul>{draft.validation.issues.map((issue, index) => <li key={`${String(issue.code)}-${index}`}><strong>{String(issue.severity)} · {String(issue.code)}</strong><br />{String(issue.message)}</li>)}</ul>}</section></>;
}

function Account() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("newPassword") ?? "");
    if (password !== String(form.get("confirmPassword") ?? "")) {
      setMessage("Новые пароли не совпадают.");
      return;
    }
    const response = await fetch("/api/admin/auth/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword: form.get("currentPassword"), newPassword: password }),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) {
      setMessage(result.error === "CURRENT_PASSWORD_INVALID" ? "Текущий пароль неверен." : "Не удалось изменить пароль.");
      return;
    }
    setMessage("Пароль изменён. Все сессии отозваны; войдите заново.");
    window.setTimeout(() => { router.replace("/admin/login"); router.refresh(); }, 1200);
  }
  return <><header className="admin-heading"><h1>Смена пароля</h1></header><form className="admin-card admin-form" onSubmit={changePassword}><label>Текущий пароль<input name="currentPassword" type="password" autoComplete="current-password" required /></label><label>Новый пароль<input name="newPassword" type="password" autoComplete="new-password" minLength={14} required /></label><label>Повторите новый пароль<input name="confirmPassword" type="password" autoComplete="new-password" minLength={14} required /></label><button className="button-primary">Изменить пароль</button>{message && <p role="status">{message}</p>}</form></>;
}

function Users() {
  const [data, setData] = useState<{ users?: Json[]; error?: string }>({});
  async function load() { setData(await fetch("/api/admin/users").then((r) => r.json())); }
  useEffect(() => {
    void fetch("/api/admin/users").then((response) => response.json()).then(setData);
  }, []);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "CREATE", username: form.get("username"), password: form.get("password"), role: form.get("role") }) });
    if (response.ok) { event.currentTarget.reset(); await load(); }
  }
  async function mutate(payload: Json) { await fetch("/api/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); await load(); }
  async function resetPassword(userId: unknown) {
    const password = window.prompt("Введите новый пароль (минимум 14 символов). Значение не будет сохранено в браузере.");
    if (!password) return;
    await mutate({ action: "RESET_PASSWORD", userId, password });
  }
  return <><header className="admin-heading"><h1>Пользователи</h1></header><form className="admin-card admin-form" onSubmit={create}><h2>Создать пользователя</h2><label>Username<input name="username" required /></label><label>Новый пароль<input name="password" type="password" minLength={14} required /></label><label>Роль<select name="role"><option>EDITOR</option><option>ADMIN</option></select></label><button className="button-primary">Создать</button></form><div className="admin-grid">{data.users?.map((user) => <article className="admin-card" key={String(user.id)}><h2>{String(user.username)}</h2><p>{String(user.role)} · {user.active ? "active" : "disabled"}</p><p>Создан: {user.createdAt ? new Date(String(user.createdAt)).toLocaleString("ru") : "—"}</p><p>Последний вход: {user.lastLoginAt ? new Date(String(user.lastLoginAt)).toLocaleString("ru") : "—"}</p><p>Активных сессий: {String(user.activeSessions)}</p><label>Роль<select value={String(user.role)} onChange={(event) => void mutate({ action: "SET_ROLE", userId: user.id, role: event.target.value })}><option>EDITOR</option><option>ADMIN</option></select></label><div className="admin-actions"><button className="button-secondary" onClick={() => void mutate({ action: "SET_ACTIVE", userId: user.id, active: !user.active })}>{user.active ? "Отключить" : "Включить"}</button><button className="button-secondary" onClick={() => void resetPassword(user.id)}>Сбросить пароль</button></div></article>)}</div></>;
}

function Versions() {
  const [versions, setVersions] = useState<Json | null>(null);
  const [preparation, setPreparation] = useState<Json | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => { void Promise.all([fetch("/api/admin/versions").then((r) => r.json()), fetch("/api/admin/publish").then((r) => r.json())]).then(([v, p]) => { setVersions(v); setPreparation(p); }); }, []);
  async function publish() {
    if (!preparation || !confirm("Опубликовать текущий валидный DRAFT как новую immutable версию?")) return;
    const response = await fetch("/api/admin/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedUpdatedAt: preparation.expectedUpdatedAt, label: `Admin publish ${new Date().toISOString()}` }) });
    const result = await response.json() as Json;
    setMessage(response.ok ? `Опубликована версия ${String(result.id)}` : String(result.error));
  }
  return <><header className="admin-heading"><h1>Версии и публикация</h1></header><div className="admin-grid"><section className="admin-card"><h2>Publish readiness</h2><pre>{JSON.stringify(preparation, null, 2)}</pre><button className="button-primary" onClick={() => void publish()} disabled={Boolean((preparation?.validation as Json | undefined)?.valid === false)}>Publish Draft</button>{message && <p>{message}</p>}</section><section className="admin-card"><h2>История</h2><pre>{JSON.stringify(versions, null, 2)}</pre></section></div></>;
}

export function AdminConsole({ section = "overview", role }: { section?: string; role: "ADMIN" | "EDITOR" }) {
  if (section === "overview") return <AdminDashboard />;
  if (section === "preview") return <Preview />;
  if (section === "validation") return <Validation />;
  if (section === "account") return <Account />;
  if (section === "versions") return <Versions />;
  if (section === "audit") return <Audit />;
  if (section === "users") return <Users />;
  if (section === "relations") return <RelationMap />;
  if (sectionConfig[section]) return <EntitySection section={section} role={role} />;
  return <p>Раздел не найден.</p>;
}
