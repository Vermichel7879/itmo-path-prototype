"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Json = Record<string, unknown>;
type Draft = { id: string; updatedAt: string; snapshot: Json; validation: { valid: boolean; issues: Json[] } };

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
    const response = await fetch("/api/admin/draft", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ entityType: config.entityType, stableId, expectedUpdatedAt: draft.updatedAt, values }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setMessage(result.error === "DRAFT_STALE_REVISION" ? "Данные изменены другим пользователем. Обновите страницу." : result.error ?? "Не удалось сохранить"); return; }
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
  return <><header className="admin-heading"><div><p className="eyebrow">DRAFT only</p><h1>{config.title}</h1></div><span className={draft.validation.valid ? "admin-status" : "admin-status admin-status--error"}>{draft.validation.valid ? "Готово" : "Есть ошибки"}</span></header><CreateEntityForm entityType={config.entityType} draft={draft} onCreated={load} /><div className="admin-editor"><div className="admin-list">{items.map((candidate, index) => <button key={`${String(candidate.stableId ?? index)}`} onClick={() => setSelectedIndex(index)} className={index === selectedIndex ? "active" : ""}><strong>{String(candidate.stableId ?? candidate.answerStableId)}</strong><span>{String(candidate.title ?? candidate.name ?? candidate.text ?? candidate.moduleStableId ?? "")}</span>{hasAudience ? <small>{audienceLabel(candidate)}</small> : null}</button>)}</div><section className="admin-card">{!item && config.entityType === "OPPORTUNITY" ? <form className="admin-form" onSubmit={createOpportunity}><h2>Новая возможность</h2><label>Stable ID<input name="stableId" pattern="[A-Z][A-Z0-9_]*" required /></label><label>Тип<select name="type"><option>EVENT</option><option>CLUB</option><option>FACULTY</option><option>PRACTICE</option><option>INTERNSHIP</option><option>OTHER</option></select></label><label>Название<input name="title" required /></label><label>Описание<textarea name="description" required /></label><label>URL<input name="url" type="url" /></label><button className="button-primary">Создать в DRAFT</button>{message && <p>{message}</p>}</form> : !item ? <p>Записей пока нет.</p> : <form key={editorKey} onSubmit={save} className="admin-form"><h2>{String(item.stableId ?? item.answerStableId)}</h2>{hasAudience ? <fieldset><legend>Для кого</legend><label className="admin-checkbox"><input name="forBachelor" type="checkbox" defaultChecked={Boolean(item.forBachelor)} /> Бакалавриат</label><label className="admin-checkbox"><input name="forMaster" type="checkbox" defaultChecked={Boolean(item.forMaster)} /> Магистратура</label></fieldset> : null}{valueFields(config.entityType).filter((field) => !["forBachelor", "forMaster"].includes(field)).map((field) => typeof item[field] === "boolean" ? <label key={field} className="admin-checkbox"><input name={field} type="checkbox" defaultChecked={Boolean(item[field])} /> {field}</label> : <label key={field}>{field}{Array.isArray(item[field]) && <small>через запятую</small>}<textarea name={field} defaultValue={Array.isArray(item[field]) ? (item[field] as unknown[]).join(", ") : String(item[field] ?? "")} rows={["description", "goal", "sourceContent"].includes(field) ? 5 : 2} /></label>)}{config.entityType === "QUESTION" && <label>Условие показа<select name="showCondition" defaultValue={item.showCondition ? "ENTREPRENEUR_SIGNAL" : "ALWAYS"}><option value="ALWAYS">Показывать всегда</option><option value="ENTREPRENEUR_SIGNAL">Только при entrepreneur_signal</option></select></label>}{config.entityType === "RULE" && <TypedFields prefix="params" value={item.params} />}{config.entityType === "MODIFIER" && <><TypedFields prefix="effect" value={item.effect} /><TypedFields prefix="params" value={(item.operation as Json).params} /></>}{["RULE", "MODIFIER"].includes(config.entityType) && <details><summary>Typed JSON preview (read-only)</summary><pre>{JSON.stringify(item.params ?? item.operation, null, 2)}</pre></details>}{["RULE", "MODIFIER", "WEIGHT"].includes(config.entityType) && <p className="admin-hint">Критическая логика. Изменения доступны только ADMIN и проходят полную typed validation.</p>}<button className="button-primary" disabled={logicLocked}>Сохранить</button>{logicLocked && <p className="admin-hint">Критическая логика доступна только ADMIN.</p>}{message && <p role="status">{message}</p>}</form>}</section></div></>;
}

function Preview() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [result, setResult] = useState<Json | null>(null);
  useEffect(() => { void fetch("/api/admin/draft").then((r) => r.json()).then(setDraft); }, []);
  async function run(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const ids = new FormData(event.currentTarget).getAll("answers"); const response = await fetch("/api/admin/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ selectedAnswerIds: ids, educationLevel: "MASTER" }) }); setResult(await response.json()); }
  if (!draft) return <p>Загрузка…</p>;
  const answers = draft.snapshot.answers as Json[];
  return <><header className="admin-heading"><div><p className="eyebrow">Тот же production engine · Магистратура</p><h1>Preview DRAFT</h1></div></header><form onSubmit={run} className="admin-card admin-preview-form">{(draft.snapshot.questions as Json[]).filter((question) => question.forMaster !== false).map((question) => <fieldset key={String(question.stableId)}><legend>{String(question.stableId)} · {String(question.text)}</legend>{answers.filter((a) => a.questionStableId === question.stableId).map((answer) => <label key={String(answer.stableId)}><input type={question.selectionType === "SINGLE" ? "radio" : "checkbox"} name="answers" value={String(answer.stableId)} /> {String(answer.text)}</label>)}</fieldset>)}<button className="button-primary">Рассчитать DRAFT</button></form>{result && <div className="admin-grid"><section className="admin-card"><h2>Public-style result</h2><pre>{JSON.stringify(result.result ?? result, null, 2)}</pre></section><section className="admin-card"><h2>Technical debug</h2><pre>{JSON.stringify(result.debug ?? result, null, 2)}</pre></section></div>}<section className="admin-card"><h2>E01–E07 — documentation only</h2><pre>{JSON.stringify(draft.snapshot.documentationExamples, null, 2)}</pre></section></>;
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
  if (sectionConfig[section]) return <EntitySection section={section} role={role} />;
  return <p>Раздел не найден.</p>;
}
