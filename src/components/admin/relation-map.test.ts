import { describe, expect, it } from "vitest";

import { buildRelationMapModel, buildStructuralCounters, structuralCounterLabel } from "./relation-map";

const snapshot = {
  questions: [{ stableId: "Q1", text: "Первый вопрос", active: true, forBachelor: true, forMaster: true }],
  answers: [
    { stableId: "Q1_A1", questionStableId: "Q1", text: "Первый ответ", active: true },
    { stableId: "Q1_A2", questionStableId: "Q1", text: "Второй ответ", active: false },
  ],
  mappings: [
    { answerStableId: "Q1_A1", moduleStableId: "M01", weight: 4 },
    { answerStableId: "Q1_A2", moduleStableId: "M01", weight: 2 },
    { answerStableId: "Q1_A1", moduleStableId: "M02", weight: 1 },
  ],
  modules: [
    { stableId: "M01", name: "Выбор направления", active: true, forBachelor: true, forMaster: true },
    { stableId: "M02", name: "Профиль навыков", active: false, forBachelor: false, forMaster: true },
  ],
  recommendations: [{ stableId: "REC01", title: "Карьерная консультация", status: "ACTIVE", active: true, forBachelor: true, forMaster: true }],
  moduleRecommendations: [
    { moduleStableId: "M01", recommendationStableId: "REC01", priority: 3 },
    { moduleStableId: "M02", recommendationStableId: "REC01", priority: 5 },
  ],
};

describe("admin relation map", () => {
  it("calculates structural counters from one DRAFT snapshot", () => {
    const counters = buildStructuralCounters(snapshot);
    expect(counters.questions.Q1).toEqual({ answers: 2, mappings: 3 });
    expect(counters.answers.Q1_A1).toEqual({ modules: 2 });
    expect(counters.modules.M01).toEqual({ incomingMappings: 2, recommendations: 1 });
    expect(counters.recommendations.REC01).toEqual({ modules: 2 });
    expect(structuralCounterLabel("MODULE", "M01", counters)).toBe("2 входящих связей · 1 рекомендаций");
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
});
