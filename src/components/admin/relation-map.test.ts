import { describe, expect, it } from "vitest";

import {
  buildRelationGraphModel,
  buildRelationMapModel,
  buildStructuralCounters,
  filterRelationGraphFocusOptions,
  structuralCounterLabel,
} from "./relation-map";

const snapshot = {
  questions: [
    { stableId: "Q1", text: "Первый вопрос", active: true, forBachelor: true, forMaster: true },
    { stableId: "Q2", text: "Несвязанный вопрос", active: true, forBachelor: false, forMaster: true },
  ],
  answers: [
    { stableId: "Q1_A1", questionStableId: "Q1", text: "Первый ответ", active: true },
    { stableId: "Q1_A2", questionStableId: "Q1", text: "Второй ответ", active: false },
    { stableId: "Q2_A1", questionStableId: "Q2", text: "Ответ другого вопроса", active: true },
  ],
  mappings: [
    { answerStableId: "Q1_A1", moduleStableId: "M01", weight: 4 },
    { answerStableId: "Q1_A2", moduleStableId: "M01", weight: 2 },
    { answerStableId: "Q1_A1", moduleStableId: "M02", weight: 1 },
    { answerStableId: "Q2_A1", moduleStableId: "M01", weight: 6 },
  ],
  modules: [
    { stableId: "M01", name: "Выбор направления", active: true, forBachelor: true, forMaster: true },
    { stableId: "M02", name: "Профиль навыков", active: false, forBachelor: false, forMaster: true },
  ],
  recommendations: [
    { stableId: "REC01", title: "Карьерная консультация", status: "ACTIVE", active: true, forBachelor: true, forMaster: true },
    { stableId: "REC02", title: "Несвязанная рекомендация", status: "ACTIVE", active: true, forBachelor: false, forMaster: true },
  ],
  moduleRecommendations: [
    { moduleStableId: "M01", recommendationStableId: "REC01", priority: 3 },
    { moduleStableId: "M02", recommendationStableId: "REC01", priority: 5 },
    { moduleStableId: "M02", recommendationStableId: "REC02", priority: 7 },
  ],
};

describe("admin relation map", () => {
  it("calculates structural counters from one DRAFT snapshot", () => {
    const counters = buildStructuralCounters(snapshot);
    expect(counters.questions.Q1).toEqual({ answers: 2, mappings: 3 });
    expect(counters.answers.Q1_A1).toEqual({ modules: 2 });
    expect(counters.modules.M01).toEqual({ incomingMappings: 3, recommendations: 1 });
    expect(counters.recommendations.REC01).toEqual({ modules: 2 });
    expect(structuralCounterLabel("MODULE", "M01", counters)).toBe("3 входящих связей · 1 рекомендаций");
  });

  it("builds a focused module view with weights, priorities and human labels", () => {
    const model = buildRelationMapModel(snapshot, { kind: "MODULE", stableId: "M01" });
    expect(model?.focus).toMatchObject({ label: "Выбор направления", audience: "BA · MA", active: true });
    expect(model?.modules[0].incomingAnswers).toEqual(expect.arrayContaining([
      expect.objectContaining({ weight: 4, entity: expect.objectContaining({ label: "Первый ответ" }) }),
    ]));
    expect(model?.modules[0].recommendations).toEqual([
      expect.objectContaining({ priority: 3, entity: expect.objectContaining({ label: "Карьерная консультация" }) }),
    ]);
  });

  it("builds an answer path from its question through modules to recommendations", () => {
    const model = buildRelationMapModel(snapshot, { kind: "ANSWER", stableId: "Q1_A1" });
    expect(model?.question?.stableId).toBe("Q1");
    expect(model?.answers[0].label).toBe("Первый ответ");
    expect(model?.modules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        weight: 4,
        entity: expect.objectContaining({ stableId: "M01" }),
        recommendations: [expect.objectContaining({ priority: 3 })],
      }),
    ]));
  });

  it("builds Question→Answer, weighted Answer→Module and prioritized Module→Recommendation edges", () => {
    const graph = buildRelationGraphModel(snapshot, { focus: { kind: "QUESTION", stableId: "Q1" } });
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "QUESTION:Q1", target: "ANSWER:Q1_A1", kind: "QUESTION_ANSWER" }),
      expect.objectContaining({ source: "ANSWER:Q1_A1", target: "MODULE:M01", kind: "ANSWER_MODULE", label: "weight 4" }),
      expect.objectContaining({ source: "MODULE:M01", target: "RECOMMENDATION:REC01", kind: "MODULE_RECOMMENDATION", label: "priority 3" }),
    ]));
  });

  it("filters the graph by audience without hiding inactive items by default", () => {
    const all = buildRelationGraphModel(snapshot, { focus: { kind: "QUESTION", stableId: "Q1" } });
    expect(all.nodes.find((node) => node.key === "ANSWER:Q1_A2")).toMatchObject({ active: false });
    expect(all.nodes.find((node) => node.key === "MODULE:M02")).toMatchObject({ active: false, audience: "MA" });

    const bachelor = buildRelationGraphModel(snapshot, { audience: "BACHELOR", focus: { kind: "QUESTION", stableId: "Q1" } });
    expect(bachelor.nodes.some((node) => node.key === "MODULE:M02")).toBe(false);
    expect(bachelor.edges.some((edge) => edge.source === "ANSWER:Q1_A1" && edge.target === "MODULE:M02")).toBe(false);
    expect(bachelor.nodes.some((node) => node.key === "QUESTION:Q1")).toBe(true);
  });

  it("narrows the graph by Question or Module focus", () => {
    const question = buildRelationGraphModel(snapshot, { focus: { kind: "QUESTION", stableId: "Q1" } });
    expect(question.nodes.map((node) => node.key)).toEqual(expect.arrayContaining([
      "QUESTION:Q1",
      "ANSWER:Q1_A1",
      "MODULE:M01",
      "RECOMMENDATION:REC01",
    ]));
    expect(question.nodes.some((node) => node.key === "QUESTION:Q2")).toBe(false);
    expect(question.nodes.some((node) => node.key === "ANSWER:Q2_A1")).toBe(false);

    const careerModule = buildRelationGraphModel(snapshot, { focus: { kind: "MODULE", stableId: "M01" } });
    expect(careerModule.nodes.some((node) => node.key === "MODULE:M02")).toBe(false);
    expect(careerModule.nodes.map((node) => node.key)).toEqual(expect.arrayContaining([
      "QUESTION:Q1",
      "QUESTION:Q2",
      "ANSWER:Q1_A1",
      "ANSWER:Q2_A1",
      "MODULE:M01",
      "RECOMMENDATION:REC01",
    ]));
    expect(careerModule.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "ANSWER:Q2_A1", target: "MODULE:M01", label: "weight 6" }),
      expect.objectContaining({ source: "MODULE:M01", target: "RECOMMENDATION:REC01", label: "priority 3" }),
    ]));
    expect(careerModule.nodes.some((node) => node.key === "RECOMMENDATION:REC02")).toBe(false);
  });

  it("searches selectable Questions and Modules by label or Stable ID", () => {
    expect(filterRelationGraphFocusOptions(snapshot, {
      kind: "MODULE",
      query: "Профиль навыков",
    }).map((item) => item.stableId)).toEqual(["M02"]);
    expect(filterRelationGraphFocusOptions(snapshot, {
      kind: "QUESTION",
      query: "Q2",
    }).map((item) => item.stableId)).toEqual(["Q2"]);
    expect(filterRelationGraphFocusOptions(snapshot, {
      kind: "QUESTION",
      audience: "BACHELOR",
    }).map((item) => item.stableId)).toEqual(["Q1"]);
  });
});
