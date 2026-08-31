export type RelationEntityKind = "QUESTION" | "ANSWER" | "MODULE" | "RECOMMENDATION";

type Json = Record<string, unknown>;

export type RelationSnapshot = {
  questions?: Json[];
  answers?: Json[];
  mappings?: Json[];
  modules?: Json[];
  recommendations?: Json[];
  moduleRecommendations?: Json[];
};

export type RelationEntity = {
  kind: RelationEntityKind;
  stableId: string;
  label: string;
  active: boolean;
  audience: string;
  status?: string;
};

export type RelationFocus = Pick<RelationEntity, "kind" | "stableId">;

export type RelationModule = {
  entity: RelationEntity;
  weight?: number;
  incomingAnswers: Array<{ entity: RelationEntity; question: RelationEntity; weight: number }>;
  recommendations: Array<{ entity: RelationEntity; priority: number }>;
};

export type RelationMapModel = {
  focus: RelationEntity;
  question?: RelationEntity;
  answers: RelationEntity[];
  modules: RelationModule[];
};

export type RelationGraphAudience = "ALL" | "MASTER" | "BACHELOR";

export type RelationGraphNode = RelationEntity & {
  key: string;
  x: number;
  y: number;
};

export type RelationGraphEdge = {
  key: string;
  source: string;
  target: string;
  kind: "QUESTION_ANSWER" | "ANSWER_MODULE" | "MODULE_RECOMMENDATION";
  label?: string;
};

export type RelationGraphModel = {
  nodes: RelationGraphNode[];
  edges: RelationGraphEdge[];
  width: number;
  height: number;
};

export type RelationGraphFilters = {
  audience?: RelationGraphAudience;
  focus: RelationFocus & { kind: "QUESTION" | "MODULE" };
};

export type StructuralCounters = {
  questions: Record<string, { answers: number; mappings: number }>;
  answers: Record<string, { modules: number }>;
  modules: Record<string, { incomingMappings: number; recommendations: number }>;
  recommendations: Record<string, { modules: number }>;
};

function list(snapshot: RelationSnapshot, key: keyof RelationSnapshot) {
  return snapshot[key] ?? [];
}

function audience(item: Json, inherited?: Json) {
  const source = inherited ?? item;
  if (source.forBachelor && source.forMaster) return "BA · MA";
  if (source.forBachelor) return "BA";
  if (source.forMaster) return "MA";
  return "Аудитория не задана";
}

function entity(kind: RelationEntityKind, item: Json, inheritedAudience?: Json): RelationEntity {
  return {
    kind,
    stableId: String(item.stableId),
    label: String(item.text ?? item.name ?? item.title ?? item.stableId),
    active: item.active !== false,
    audience: audience(item, inheritedAudience),
    status: item.status === undefined ? undefined : String(item.status),
  };
}

export function buildStructuralCounters(snapshot: RelationSnapshot): StructuralCounters {
  const questions = list(snapshot, "questions");
  const answers = list(snapshot, "answers");
  const mappings = list(snapshot, "mappings");
  const modules = list(snapshot, "modules");
  const recommendations = list(snapshot, "recommendations");
  const links = list(snapshot, "moduleRecommendations");

  return {
    questions: Object.fromEntries(questions.map((question) => {
      const questionId = String(question.stableId);
      const answerIds = new Set(answers.filter((answer) => answer.questionStableId === question.stableId).map((answer) => String(answer.stableId)));
      return [questionId, {
        answers: answerIds.size,
        mappings: mappings.filter((mapping) => answerIds.has(String(mapping.answerStableId))).length,
      }];
    })),
    answers: Object.fromEntries(answers.map((answer) => [String(answer.stableId), {
      modules: new Set(mappings.filter((mapping) => mapping.answerStableId === answer.stableId).map((mapping) => String(mapping.moduleStableId))).size,
    }])),
    modules: Object.fromEntries(modules.map((careerModule) => [String(careerModule.stableId), {
      incomingMappings: mappings.filter((mapping) => mapping.moduleStableId === careerModule.stableId).length,
      recommendations: links.filter((link) => link.moduleStableId === careerModule.stableId).length,
    }])),
    recommendations: Object.fromEntries(recommendations.map((recommendation) => [String(recommendation.stableId), {
      modules: new Set(links.filter((link) => link.recommendationStableId === recommendation.stableId).map((link) => String(link.moduleStableId))).size,
    }])),
  };
}

export function structuralCounterLabel(kind: string, stableId: string, counters: StructuralCounters) {
  if (kind === "QUESTION") {
    const value = counters.questions[stableId];
    return value ? `${value.answers} ответов · ${value.mappings} маппингов` : "0 ответов · 0 маппингов";
  }
  if (kind === "ANSWER") return `${counters.answers[stableId]?.modules ?? 0} модулей`;
  if (kind === "MODULE") {
    const value = counters.modules[stableId];
    return `${value?.incomingMappings ?? 0} входящих связей · ${value?.recommendations ?? 0} рекомендаций`;
  }
  if (kind === "RECOMMENDATION") return `${counters.recommendations[stableId]?.modules ?? 0} модулей`;
  return "";
}

export function buildRelationFocusOptions(snapshot: RelationSnapshot): RelationEntity[] {
  const questions = list(snapshot, "questions");
  const questionById = new Map(questions.map((question) => [String(question.stableId), question]));
  return [
    ...questions.map((item) => entity("QUESTION", item)),
    ...list(snapshot, "answers").map((item) => entity("ANSWER", item, questionById.get(String(item.questionStableId)))),
    ...list(snapshot, "modules").map((item) => entity("MODULE", item)),
    ...list(snapshot, "recommendations").map((item) => entity("RECOMMENDATION", item)),
  ];
}

const graphColumns: RelationEntityKind[] = [
  "QUESTION",
  "ANSWER",
  "MODULE",
  "RECOMMENDATION",
];

function entityKey(kind: RelationEntityKind, stableId: string) {
  return `${kind}:${stableId}`;
}

function matchesGraphAudience(item: RelationEntity, filter: RelationGraphAudience) {
  if (filter === "ALL") return true;
  return filter === "MASTER" ? item.audience.includes("MA") : item.audience.includes("BA");
}

export function filterRelationGraphFocusOptions(
  snapshot: RelationSnapshot,
  input: {
    kind: "QUESTION" | "MODULE";
    audience?: RelationGraphAudience;
    query?: string;
  },
) {
  const audienceFilter = input.audience ?? "ALL";
  const query = input.query?.trim().toLocaleLowerCase("ru") ?? "";
  return buildRelationFocusOptions(snapshot).filter(
    (item): item is RelationEntity & { kind: "QUESTION" | "MODULE" } =>
      item.kind === input.kind &&
      matchesGraphAudience(item, audienceFilter) &&
      (!query || `${item.stableId} ${item.label}`.toLocaleLowerCase("ru").includes(query)),
  );
}

export function buildRelationGraphModel(
  snapshot: RelationSnapshot,
  filters: RelationGraphFilters,
): RelationGraphModel {
  const answers = list(snapshot, "answers");
  const entities = buildRelationFocusOptions(snapshot);
  const entityByKey = new Map(
    entities.map((item) => [entityKey(item.kind, item.stableId), item]),
  );
  const rawEdges: RelationGraphEdge[] = [
    ...answers.map((answer) => ({
      key: `qa:${String(answer.questionStableId)}:${String(answer.stableId)}`,
      source: entityKey("QUESTION", String(answer.questionStableId)),
      target: entityKey("ANSWER", String(answer.stableId)),
      kind: "QUESTION_ANSWER" as const,
    })),
    ...list(snapshot, "mappings").map((mapping) => ({
      key: `am:${String(mapping.answerStableId)}:${String(mapping.moduleStableId)}`,
      source: entityKey("ANSWER", String(mapping.answerStableId)),
      target: entityKey("MODULE", String(mapping.moduleStableId)),
      kind: "ANSWER_MODULE" as const,
      label: `weight ${String(mapping.weight)}`,
    })),
    ...list(snapshot, "moduleRecommendations").map((link) => ({
      key: `mr:${String(link.moduleStableId)}:${String(link.recommendationStableId)}`,
      source: entityKey("MODULE", String(link.moduleStableId)),
      target: entityKey("RECOMMENDATION", String(link.recommendationStableId)),
      kind: "MODULE_RECOMMENDATION" as const,
      label: `priority ${String(link.priority)}`,
    })),
  ].filter((edge) => entityByKey.has(edge.source) && entityByKey.has(edge.target));

  const audience = filters.audience ?? "ALL";
  let included = new Set(
    entities
      .filter((item) => matchesGraphAudience(item, audience))
      .map((item) => entityKey(item.kind, item.stableId)),
  );

  const focusKey = entityKey(filters.focus.kind, filters.focus.stableId);
  const focused = new Set<string>([focusKey]);
  if (filters.focus.kind === "QUESTION") {
    rawEdges
      .filter((edge) => edge.kind === "QUESTION_ANSWER" && edge.source === focusKey)
      .forEach((edge) => focused.add(edge.target));
    rawEdges
      .filter((edge) => edge.kind === "ANSWER_MODULE" && focused.has(edge.source))
      .forEach((edge) => focused.add(edge.target));
    rawEdges
      .filter((edge) => edge.kind === "MODULE_RECOMMENDATION" && focused.has(edge.source))
      .forEach((edge) => focused.add(edge.target));
  } else {
    rawEdges
      .filter((edge) => edge.kind === "ANSWER_MODULE" && edge.target === focusKey)
      .forEach((edge) => focused.add(edge.source));
    rawEdges
      .filter((edge) => edge.kind === "QUESTION_ANSWER" && focused.has(edge.target))
      .forEach((edge) => focused.add(edge.source));
    rawEdges
      .filter((edge) => edge.kind === "MODULE_RECOMMENDATION" && edge.source === focusKey)
      .forEach((edge) => focused.add(edge.target));
  }
  included = new Set([...included].filter((key) => focused.has(key)));

  const edges = rawEdges.filter(
    (edge) => included.has(edge.source) && included.has(edge.target),
  );
  const nodeWidth = 240;
  const nodeHeight = 86;
  const columnGap = 110;
  const rowGap = 22;
  const padding = 36;
  const nodes: RelationGraphNode[] = [];
  graphColumns.forEach((kind, columnIndex) => {
    entities
      .filter((item) => item.kind === kind && included.has(entityKey(kind, item.stableId)))
      .forEach((item, rowIndex) => nodes.push({
        ...item,
        key: entityKey(kind, item.stableId),
        x: padding + columnIndex * (nodeWidth + columnGap),
        y: padding + rowIndex * (nodeHeight + rowGap),
      }));
  });
  const tallestColumn = Math.max(
    1,
    ...graphColumns.map((kind) => nodes.filter((node) => node.kind === kind).length),
  );
  return {
    nodes,
    edges,
    width: padding * 2 + graphColumns.length * nodeWidth + (graphColumns.length - 1) * columnGap,
    height: padding * 2 + tallestColumn * nodeHeight + (tallestColumn - 1) * rowGap,
  };
}

export function buildRelationMapModel(snapshot: RelationSnapshot, selected: RelationFocus): RelationMapModel | null {
  const questions = list(snapshot, "questions");
  const answers = list(snapshot, "answers");
  const modules = list(snapshot, "modules");
  const recommendations = list(snapshot, "recommendations");
  const mappings = list(snapshot, "mappings");
  const links = list(snapshot, "moduleRecommendations");
  const questionById = new Map(questions.map((item) => [String(item.stableId), item]));
  const answerById = new Map(answers.map((item) => [String(item.stableId), item]));
  const moduleById = new Map(modules.map((item) => [String(item.stableId), item]));
  const recommendationById = new Map(recommendations.map((item) => [String(item.stableId), item]));
  const options = buildRelationFocusOptions(snapshot);
  const focus = options.find((item) => item.kind === selected.kind && item.stableId === selected.stableId);
  if (!focus) return null;

  const answerRows = selected.kind === "QUESTION"
    ? answers.filter((answer) => answer.questionStableId === selected.stableId)
    : selected.kind === "ANSWER"
      ? answers.filter((answer) => answer.stableId === selected.stableId)
      : selected.kind === "MODULE"
        ? mappings.filter((mapping) => mapping.moduleStableId === selected.stableId).map((mapping) => answerById.get(String(mapping.answerStableId))).filter((item): item is Json => Boolean(item))
        : [];
  const answerIds = new Set(answerRows.map((answer) => String(answer.stableId)));
  const moduleRows = selected.kind === "MODULE"
    ? modules.filter((careerModule) => careerModule.stableId === selected.stableId)
    : selected.kind === "RECOMMENDATION"
      ? links.filter((link) => link.recommendationStableId === selected.stableId).map((link) => moduleById.get(String(link.moduleStableId))).filter((item): item is Json => Boolean(item))
      : mappings.filter((mapping) => answerIds.has(String(mapping.answerStableId))).map((mapping) => moduleById.get(String(mapping.moduleStableId))).filter((item): item is Json => Boolean(item));
  const uniqueModules = [...new Map(moduleRows.map((item) => [String(item.stableId), item])).values()];
  const question = selected.kind === "ANSWER"
    ? questionById.get(String(answerRows[0]?.questionStableId))
    : selected.kind === "QUESTION"
      ? questionById.get(selected.stableId)
      : undefined;

  return {
    focus,
    question: question ? entity("QUESTION", question) : undefined,
    answers: answerRows.map((answer) => entity("ANSWER", answer, questionById.get(String(answer.questionStableId)))),
    modules: uniqueModules.map((careerModule) => ({
      entity: entity("MODULE", careerModule),
      weight: selected.kind === "ANSWER"
        ? Number(mappings.find((mapping) => mapping.answerStableId === selected.stableId && mapping.moduleStableId === careerModule.stableId)?.weight)
        : undefined,
      incomingAnswers: mappings
        .filter((mapping) => mapping.moduleStableId === careerModule.stableId)
        .map((mapping) => {
          const answer = answerById.get(String(mapping.answerStableId));
          const question = answer ? questionById.get(String(answer.questionStableId)) : undefined;
          return answer && question ? { entity: entity("ANSWER", answer, question), question: entity("QUESTION", question), weight: Number(mapping.weight) } : null;
        })
        .filter((item): item is { entity: RelationEntity; question: RelationEntity; weight: number } => Boolean(item)),
      recommendations: links
        .filter((link) => link.moduleStableId === careerModule.stableId && (selected.kind !== "RECOMMENDATION" || link.recommendationStableId === selected.stableId))
        .map((link) => {
          const recommendation = recommendationById.get(String(link.recommendationStableId));
          return recommendation ? { entity: entity("RECOMMENDATION", recommendation), priority: Number(link.priority) } : null;
        })
        .filter((item): item is { entity: RelationEntity; priority: number } => Boolean(item)),
    })),
  };
}
