import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { cloneElement } from "react";

import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";

import type { TrajectoryResult } from "@/lib/rule-engine/types";

import { prepareTrajectoryPdfData } from "./trajectory-pdf-data";
import { TrajectoryPdfDocument } from "./trajectory-pdf";

const longStep = "Найти 10–15 актуальных вакансий, сравнить задачи, требования и повторяющиеся навыки, затем зафиксировать закономерности для следующей проверки. ".repeat(10).trim();
const veryLongStep = `${longStep} `.repeat(3).trim();
const longCheckpoint = "Зафиксирован проверенный карьерный фокус, собраны примеры задач и сформулирован следующий эксперимент. ".repeat(18).trim();
const longPace = "Двигайтесь последовательно, оставляя время на фиксацию результатов и корректировку следующего действия. ".repeat(18).trim();

function persistQaPdf(name: string, buffer: Buffer) {
  const outputDirectory = process.env.PDF_QA_OUTPUT_DIR;
  if (!outputDirectory) return;
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(resolve(outputDirectory, `${name}.pdf`), buffer);
}

function pdfPageCount(buffer: Buffer) {
  return (buffer.toString("latin1").match(/\/Type \/Page(?!s)/g) ?? []).length;
}

interface PdfLayoutNode {
  box?: { top?: number; height?: number };
  children?: PdfLayoutNode[];
  value?: string;
}

function collectLayoutText(node: PdfLayoutNode): string {
  if (node.value) return node.value;
  return (node.children ?? []).map(collectLayoutText).join(" ");
}

async function renderWithLayout(data: Awaited<ReturnType<typeof prepareTrajectoryPdfData>>) {
  let layout: PdfLayoutNode | undefined;
  const document = TrajectoryPdfDocument({
    data,
    assets: {
      fontSrc: resolve("public/fonts/golos-text-variable.ttf"),
      logoSrc: resolve("public/brand/itmo-logo-black.jpg"),
    },
  });
  const buffer = await renderToBuffer(cloneElement(document, {
    onRender: (props: { _INTERNAL__LAYOUT__DATA_?: PdfLayoutNode }) => {
      layout = props._INTERNAL__LAYOUT__DATA_;
    },
  }));
  if (!layout) throw new Error("PDF layout data was not returned");
  return { buffer, layout };
}

function expectFooterClear(layout: PdfLayoutNode) {
  for (const page of layout.children ?? []) {
    const children = page.children ?? [];
    const footer = children.find((child) => collectLayoutText(child).includes("Центр карьеры ИТМО"));
    const content = children[1];
    expect(footer?.box?.top).toBeDefined();
    expect((content.box?.top ?? 0) + (content.box?.height ?? 0)).toBeLessThanOrEqual(footer!.box!.top!);
  }
}

const result: TrajectoryResult = {
  configVersionId: "0699b9e9-790e-4909-b84c-946ee3d70233",
  primaryModule: { id: "M01", name: "Выбор направления", goal: "Определить фокус.", steps: [longStep, longStep, longStep], checkpoint: "Фокус проверен." },
  supportModules: ["M02", "M03"].map((id) => ({ id, name: id, goal: `Цель ${id}`, steps: ["Один", "Два", "Три"], checkpoint: `Checkpoint ${id}` })),
  currentPoint: "Сейчас главный фокус — определить направление.",
  priorities: ["Практика"],
  steps: [longStep, longStep, longStep],
  adjustments: [],
  pace: null,
  recommendations: [1, 2, 3].map((index) => ({ id: `RESOURCE_${index}`, type: "GENERAL", title: `Ресурс ${index}`, description: "Описание", url: null })),
  checkpoint: "Выбран и проверен карьерный фокус.",
  disclaimer: "Это стартовая траектория.",
  entrepreneurship: { active: false, stage: null, challengeAdjustments: [] },
};

describe("trajectory PDF rendering", () => {
  it("renders long full steps with two support focuses and three recommendations", async () => {
    const data = await prepareTrajectoryPdfData(result);
    const { buffer } = await renderWithLayout(data);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(buffer.byteLength).toBeGreaterThan(10_000);
    expect(data.steps).toEqual(result.steps);
    persistQaPdf("long-steps-three-resources", buffer);
  }, 30_000);

  it.each([
    {
      name: "short content with a final block that fits",
      expectedPages: 2,
      value: {
        ...result,
        steps: ["Короткий шаг 1", "Короткий шаг 2", "Короткий шаг 3"] as [string, string, string],
        supportModules: [],
        recommendations: [],
      },
    },
    {
      name: "very long steps, checkpoint, and pace",
      expectedPages: null,
      value: {
        ...result,
        steps: [veryLongStep, veryLongStep, veryLongStep] as [string, string, string],
        checkpoint: longCheckpoint,
        pace: { key: "pace_normal", text: longPace, actionsPerWeekMin: 2, actionsPerWeekMax: 2, parallelExperimentAllowed: false },
      },
    },
    {
      name: "three recommendations with URLs",
      expectedPages: null,
      value: {
        ...result,
        recommendations: [
          { id: "CKO_CONSULT", type: "CKO_SERVICE", title: "Консультация", description: "Обсудить маршрут.", url: "https://example.test/consult" },
          { id: "EVENT_1", type: "EVENT", title: "Событие", description: "Поговорить с работодателями.", url: "https://example.test/event" },
          { id: "GEN_MARKET_SCAN", type: "GENERAL", title: "Обзор рынка", description: "Сравнить требования.", url: "https://example.test/market" },
        ],
      },
    },
    {
      name: "mixed recommendations with and without URLs",
      expectedPages: null,
      value: {
        ...result,
        recommendations: [
          { id: "CKO_CONSULT", type: "CKO_SERVICE", title: "Консультация", description: "Обсудить маршрут.", url: "https://example.test/consult" },
          { id: "GEN_MARKET_SCAN", type: "GENERAL", title: "Обзор рынка", description: "Сравнить требования.", url: null },
        ],
      },
    },
  ])("renders $name without clipping the document generation", async ({ name, expectedPages, value }) => {
    const data = await prepareTrajectoryPdfData(value);
    const { buffer, layout } = await renderWithLayout(data);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(buffer.byteLength).toBeGreaterThan(10_000);
    expect(data.steps).toEqual(value.steps);
    expect(data.checkpoint).toBe(value.checkpoint);
    if (expectedPages !== null) {
      expect(pdfPageCount(buffer)).toBe(expectedPages);
    } else {
      expect(pdfPageCount(buffer)).toBeGreaterThan(2);
    }
    const checkpointPage = layout.children?.findIndex((page) => collectLayoutText(page).includes("У вас должно быть:"));
    const disclaimerPage = layout.children?.findIndex((page) => collectLayoutText(page).includes(data.disclaimer));
    expect(checkpointPage).toBeGreaterThanOrEqual(1);
    expect(disclaimerPage).toBe(checkpointPage);
    expectFooterClear(layout);
    persistQaPdf(name.replaceAll(" ", "-"), buffer);
  }, 30_000);
});
