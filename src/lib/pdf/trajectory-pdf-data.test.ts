import jsQR from "jsqr";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";

import type { TrajectoryResult } from "@/lib/rule-engine/types";

import {
  compactPdfPreviewText,
  isPdfResourceWhitelisted,
  pdfPaceLabel,
  prepareTrajectoryPdfData,
} from "./trajectory-pdf-data";

const result: TrajectoryResult = {
  configVersionId: "0699b9e9-790e-4909-b84c-946ee3d70233",
  primaryModule: {
    id: "M01",
    name: "Выбор направления",
    goal: "Определить следующий карьерный фокус.",
    steps: ["Шаг один", "Шаг два", "Шаг три"],
    checkpoint: "Выбран и проверен карьерный фокус.",
  },
  supportModules: ["M02", "M03", "M04"].map((id) => ({
    id,
    name: id,
    goal: `Цель ${id}`,
    steps: ["Один", "Два", "Три"],
    checkpoint: `Checkpoint ${id}`,
  })),
  currentPoint: "Сейчас главный фокус — определить направление.",
  priorities: ["Практика", "Обратная связь"],
  steps: ["Шаг один", "Шаг два", "Шаг три"],
  adjustments: [],
  pace: {
    key: "pace_normal",
    text: "Два действия в неделю.",
    actionsPerWeekMin: 2,
    actionsPerWeekMax: 2,
    parallelExperimentAllowed: false,
  },
  recommendations: [],
  checkpoint: "Выбран и проверен карьерный фокус.",
  disclaimer: "Это стартовая траектория, а не карьерная диагностика.",
  entrepreneurship: { active: false, stage: null, challengeAdjustments: [] },
};

describe("trajectory PDF public data policy", () => {
  it("allows hyperlinks only for approved slot ids or opportunity types", () => {
    expect(isPdfResourceWhitelisted({ id: "CKO_CONSULT", type: "CKO_SERVICE", title: "A", description: "B", url: null })).toBe(true);
    expect(isPdfResourceWhitelisted({ id: "GEN_MARKET_SCAN", type: "GENERAL", title: "A", description: "B", url: null })).toBe(true);
    expect(isPdfResourceWhitelisted({ id: "EVENT_2026", type: "EVENT", title: "A", description: "B", url: null })).toBe(true);
    expect(isPdfResourceWhitelisted({ id: "CKO_RESUME", type: "CKO_SERVICE", title: "A", description: "B", url: null })).toBe(false);
  });

  it("creates a decodable black-on-white QR only for a whitelisted real URL", async () => {
    const url = "https://example.test/career-resource";
    const data = await prepareTrajectoryPdfData({
      ...result,
      recommendations: [
        { id: "CKO_CONSULT", type: "CKO_SERVICE", title: "Консультация", description: "Описание", url },
        { id: "CKO_RESUME", type: "CKO_SERVICE", title: "Резюме", description: "Описание", url: "https://example.test/not-whitelisted" },
        { id: "GEN_MARKET_SCAN", type: "GENERAL", title: "Рынок", description: "Описание", url: null },
      ],
    });
    expect(data.resources[0].href).toBe(url);
    expect(data.resources[1]).toMatchObject({ href: null, qrDataUrl: null });
    expect(data.resources[2]).toMatchObject({ href: null, qrDataUrl: null });

    const png = PNG.sync.read(Buffer.from(data.resources[0].qrDataUrl!.split(",")[1], "base64"));
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    expect(decoded?.data).toBe(url);
  }, 15_000);

  it("rejects non-http URLs even for an approved resource", async () => {
    const data = await prepareTrajectoryPdfData({
      ...result,
      recommendations: [
        {
          id: "CKO_CONSULT",
          type: "CKO_SERVICE",
          title: "Консультация",
          description: "Описание",
          url: "javascript:alert(1)",
        },
      ],
    });
    expect(data.resources[0]).toMatchObject({ href: null, qrDataUrl: null });
  });

  it("caps support/resources and exposes only a human-facing pace label", async () => {
    const data = await prepareTrajectoryPdfData(result);
    expect(data.supportModules).toHaveLength(2);
    expect(data.resources).toHaveLength(0);
    expect(data.paceLabel).toBe("Ровный темп");
    expect(pdfPaceLabel("intensive")).toBe("Интенсивный темп");
  });

  it("preserves complete long step text and supports 1/2 focuses with 1/2/3 recommendations", async () => {
    const longStep = "Найти актуальные вакансии, сравнить задачи и требования, выписать повторяющиеся навыки и сохранить все выводы без сокращения. ".repeat(8).trim();
    for (const supportCount of [1, 2]) {
      for (const recommendationCount of [1, 2, 3]) {
        const data = await prepareTrajectoryPdfData({
          ...result,
          steps: [longStep, `${longStep} Второй шаг.`, `${longStep} Третий шаг.`],
          supportModules: result.supportModules.slice(0, supportCount),
          recommendations: Array.from({ length: recommendationCount }, (_, index) => ({
            id: `RESOURCE_${index + 1}`,
            type: "GENERAL",
            title: `Ресурс ${index + 1}`,
            description: "Описание ресурса",
            url: null,
          })),
        });
        expect(data.steps).toEqual([longStep, `${longStep} Второй шаг.`, `${longStep} Третий шаг.`]);
        expect(data.supportModules).toHaveLength(supportCount);
        expect(data.resources).toHaveLength(recommendationCount);
      }
    }
  });

  it("supports zero support modules and three approved linked resources", async () => {
    const data = await prepareTrajectoryPdfData({
      ...result,
      supportModules: [],
      recommendations: [
        { id: "CKO_CONSULT", type: "CKO_SERVICE", title: "A", description: "A", url: "https://example.test/a" },
        { id: "EVENT_1", type: "EVENT", title: "B", description: "B", url: "https://example.test/b" },
        { id: "GEN_MARKET_SCAN", type: "GENERAL", title: "C", description: "C", url: "https://example.test/c" },
      ],
    });
    expect(data.supportModules).toHaveLength(0);
    expect(data.resources).toHaveLength(3);
    expect(data.resources.every((resource) => resource.href && resource.qrDataUrl)).toBe(true);
  }, 15_000);

  it("shortens only the Page 1 preview while preserving a readable word boundary", () => {
    const long = "Провести исследование рынка и подробно зафиксировать результаты в рабочем документе для следующего карьерного шага";
    const preview = compactPdfPreviewText(long, 50);
    expect(preview.endsWith("…")).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(50);
    expect(long.startsWith(preview.slice(0, -1))).toBe(true);
  });
});
