import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import {
  type CareerImport,
  validateCareerImport,
} from "./import-model";
import {
  readXlsxWorkbook,
  type WorkbookRow,
  type WorkbookSheet,
} from "./ooxml-reader";

export const REQUIRED_CAREER_SHEETS = [
  "00_README",
  "01_Анкета",
  "02_Маппинг",
  "03_Модули",
  "04_Рекомендации",
  "05_Правила_сборки",
  "06_Примеры",
  "08_Как_редактировать",
  "09_Предпринимательство",
] as const;

function requiredSheet(
  sheets: Map<string, WorkbookSheet>,
  name: (typeof REQUIRED_CAREER_SHEETS)[number],
): WorkbookSheet {
  const sheet = sheets.get(name);
  if (!sheet) throw new Error(`В XLSX отсутствует обязательный лист ${name}`);
  return sheet;
}

function value(row: WorkbookRow, column: number): string {
  return (row.values[column] ?? "").trim();
}

function requiredValue(
  sheet: string,
  row: WorkbookRow,
  column: number,
  label: string,
): string {
  const result = value(row, column);
  if (!result) {
    throw new Error(`${sheet}!row${row.rowNumber}: не заполнено поле «${label}»`);
  }
  return result;
}

function integerValue(
  sheet: string,
  row: WorkbookRow,
  column: number,
  label: string,
): number {
  const raw = requiredValue(sheet, row, column, label);
  const result = Number(raw.replace(",", "."));
  if (!Number.isInteger(result)) {
    throw new Error(`${sheet}!row${row.rowNumber}: «${label}» должно быть целым числом`);
  }
  return result;
}

function yesNoValue(sheet: string, row: WorkbookRow, column: number): boolean {
  const raw = requiredValue(sheet, row, column, "Обязательный").toLowerCase();
  if (raw === "да") return true;
  if (raw === "нет") return false;
  throw new Error(`${sheet}!row${row.rowNumber}: ожидалось «Да» или «Нет»`);
}

function splitList(raw: string, separator = ";"): string[] {
  return raw
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
}

function matchingRows(sheet: WorkbookSheet, pattern: RegExp): WorkbookRow[] {
  return sheet.rows.filter((row) => pattern.test(value(row, 0)));
}

function recommendationType(raw: string, rowNumber: number) {
  const types: Record<
    string,
    "CKO_SERVICE" | "EVENT" | "CLUB" | "FACULTY" | "GENERAL"
  > = {
    "Сервис ЦКО": "CKO_SERVICE",
    Мероприятия: "EVENT",
    Клубы: "CLUB",
    Факультетские: "FACULTY",
    "Общая рекомендация": "GENERAL",
  };
  const type = types[raw];
  if (!type) {
    throw new Error(`04_Рекомендации!row${rowNumber}: неизвестный тип «${raw}»`);
  }
  return type;
}

function recommendationStatus(raw: string, rowNumber: number) {
  const normalized = raw.toLowerCase();
  if (normalized === "active") return "ACTIVE" as const;
  if (normalized === "slot") return "SLOT" as const;
  if (normalized === "inactive") return "INACTIVE" as const;
  throw new Error(`04_Рекомендации!row${rowNumber}: неизвестный статус «${raw}»`);
}

function findAnswerByText(
  answers: CareerImport["answers"],
  questionStableId: string,
  answerText: string,
  location: string,
): string {
  const answer = answers.find(
    (candidate) =>
      candidate.questionStableId === questionStableId &&
      candidate.text === answerText,
  );
  if (!answer) {
    throw new Error(
      `${location}: текст не совпал ни с одним ответом ${questionStableId}`,
    );
  }
  return answer.stableId;
}

export async function parseCareerWorkbook(filePath: string): Promise<CareerImport> {
  const [workbook, sourceBuffer] = await Promise.all([
    readXlsxWorkbook(filePath),
    readFile(filePath),
  ]);
  const sheets = Object.fromEntries(
    REQUIRED_CAREER_SHEETS.map((name) => [
      name,
      requiredSheet(workbook.sheets, name),
    ]),
  ) as Record<(typeof REQUIRED_CAREER_SHEETS)[number], WorkbookSheet>;

  const questions = matchingRows(sheets["01_Анкета"], /^Q\d+$/).map(
    (row, index) => {
      const rawType = requiredValue("01_Анкета", row, 3, "Тип").toLowerCase();
      if (rawType !== "single" && rawType !== "multi") {
        throw new Error(
          `01_Анкета!row${row.rowNumber}: неизвестный тип вопроса «${rawType}»`,
        );
      }
      const condition = value(row, 7);
      return {
        stableId: requiredValue("01_Анкета", row, 0, "question_id"),
        block: requiredValue("01_Анкета", row, 1, "Блок"),
        text: requiredValue("01_Анкета", row, 2, "Текст вопроса"),
        selectionType: rawType.toUpperCase() as "SINGLE" | "MULTI",
        minSelect: integerValue("01_Анкета", row, 4, "min_select"),
        maxSelect: integerValue("01_Анкета", row, 5, "max_select"),
        required: yesNoValue("01_Анкета", row, 6),
        sortOrder: index + 1,
        showCondition: condition ? { expression: condition } : null,
        active: true,
      };
    },
  );

  const answerOrder = new Map<string, number>();
  const answers = matchingRows(sheets["01_Анкета"], /^Q\d+_A\d+$/).map(
    (row) => {
      const questionStableId = requiredValue(
        "01_Анкета",
        row,
        1,
        "question_id",
      );
      const sortOrder = (answerOrder.get(questionStableId) ?? 0) + 1;
      answerOrder.set(questionStableId, sortOrder);
      const keys = splitList(value(row, 6));
      return {
        stableId: requiredValue("01_Анкета", row, 0, "answer_id"),
        questionStableId,
        text: requiredValue("01_Анкета", row, 2, "Текст ответа"),
        sortOrder,
        tags: [...keys],
        keys,
        active: true,
      };
    },
  );

  const mappings = matchingRows(sheets["02_Маппинг"], /^Q\d+_A\d+$/).map(
    (row) => ({
      answerStableId: requiredValue("02_Маппинг", row, 0, "answer_id"),
      questionStableId: requiredValue("02_Маппинг", row, 1, "question_id"),
      moduleStableId: requiredValue("02_Маппинг", row, 3, "module_id"),
      weight: integerValue("02_Маппинг", row, 4, "Вес"),
    }),
  );

  const modules = matchingRows(sheets["03_Модули"], /^M\d+$/).map((row) => {
    const steps = splitList(
      requiredValue("03_Модули", row, 3, "3 базовых шага"),
      "|",
    );
    if (steps.length !== 3) {
      throw new Error(
        `03_Модули!row${row.rowNumber}: ожидаются ровно 3 шага через «|»`,
      );
    }
    return {
      stableId: requiredValue("03_Модули", row, 0, "module_id"),
      name: requiredValue("03_Модули", row, 1, "Название модуля"),
      goal: requiredValue("03_Модули", row, 2, "Цель"),
      steps: steps as [string, string, string],
      checkpoint: requiredValue("03_Модули", row, 4, "Контрольная точка"),
      recommendationStableIds: splitList(value(row, 5)),
      constraints: value(row, 6),
      active: true,
    };
  });

  const recommendations = sheets["04_Рекомендации"].rows
    .filter((row) => row.rowNumber > 1 && value(row, 0))
    .map((row) => {
      const status = recommendationStatus(
        requiredValue("04_Рекомендации", row, 4, "Статус"),
        row.rowNumber,
      );
      return {
        stableId: requiredValue(
          "04_Рекомендации",
          row,
          0,
          "recommendation_id",
        ),
        type: recommendationType(
          requiredValue("04_Рекомендации", row, 1, "Тип"),
          row.rowNumber,
        ),
        title: requiredValue("04_Рекомендации", row, 2, "Название"),
        description: requiredValue(
          "04_Рекомендации",
          row,
          3,
          "Когда использовать",
        ),
        url: null,
        status,
        tags: [],
        active: status !== "INACTIVE",
      };
    });

  const moduleRecommendations = modules.flatMap((module) =>
    module.recommendationStableIds.map((recommendationStableId, index) => ({
      moduleStableId: module.stableId,
      recommendationStableId,
      priority: index + 1,
    })),
  );

  const modifiers = matchingRows(sheets["05_Правила_сборки"], /^MOD\d+$/).map(
    (row) => {
      const rawType = requiredValue(
        "05_Правила_сборки",
        row,
        3,
        "Тип",
      ).toLowerCase();
      if (rawType !== "copy" && rawType !== "pace") {
        throw new Error(
          `05_Правила_сборки!row${row.rowNumber}: неизвестный тип «${rawType}»`,
        );
      }
      const description = requiredValue(
        "05_Правила_сборки",
        row,
        5,
        "Эффект",
      );
      return {
        stableId: requiredValue(
          "05_Правила_сборки",
          row,
          0,
          "modifier_id",
        ),
        triggerAnswerPattern: requiredValue(
          "05_Правила_сборки",
          row,
          1,
          "trigger_answer",
        ),
        triggerTag: null,
        targetModuleStableId: requiredValue(
          "05_Правила_сборки",
          row,
          2,
          "module_id",
        ),
        type: rawType.toUpperCase() as "COPY" | "PACE",
        variantKey: requiredValue(
          "05_Правила_сборки",
          row,
          4,
          "variant_key",
        ),
        effect:
          rawType === "pace"
            ? ({ kind: "pace", description } as const)
            : ({ kind: "copy", description } as const),
        active: true,
      };
    },
  );

  const entrepreneurStages = matchingRows(
    sheets["09_Предпринимательство"],
    /^ent_stage_/,
  ).map((row, index) => {
    const answerText = requiredValue(
      "09_Предпринимательство",
      row,
      1,
      "Ответ Q9",
    );
    return {
      stableId: requiredValue(
        "09_Предпринимательство",
        row,
        0,
        "stage_key",
      ),
      answerStableId: findAnswerByText(
        answers,
        "Q9",
        answerText,
        `09_Предпринимательство!row${row.rowNumber}`,
      ),
      targetModuleStableId: "M11",
      answerText,
      focus: requiredValue(
        "09_Предпринимательство",
        row,
        2,
        "Фокус стадии",
      ),
      steps: [
        requiredValue("09_Предпринимательство", row, 3, "Шаг 1"),
        requiredValue("09_Предпринимательство", row, 4, "Шаг 2"),
        requiredValue("09_Предпринимательство", row, 5, "Шаг 3"),
      ] as [string, string, string],
      checkpoint: requiredValue(
        "09_Предпринимательство",
        row,
        6,
        "Контрольная точка",
      ),
      sortOrder: index + 1,
      active: true,
    };
  });

  const entrepreneurChallenges = matchingRows(
    sheets["09_Предпринимательство"],
    /^ent_(?!stage_)/,
  ).map((row, index) => {
    const answerText = requiredValue(
      "09_Предпринимательство",
      row,
      1,
      "Ответ Q10",
    );
    return {
      stableId: requiredValue(
        "09_Предпринимательство",
        row,
        0,
        "challenge_key",
      ),
      answerStableId: findAnswerByText(
        answers,
        "Q10",
        answerText,
        `09_Предпринимательство!row${row.rowNumber}`,
      ),
      targetModuleStableId: "M11",
      answerText,
      trajectoryAdjustment: requiredValue(
        "09_Предпринимательство",
        row,
        2,
        "Как уточнить траекторию",
      ),
      recommendationStableId: requiredValue(
        "09_Предпринимательство",
        row,
        3,
        "recommendation_id",
      ),
      sortOrder: index + 1,
      active: true,
    };
  });

  const readme = Object.fromEntries(
    sheets["00_README"].rows
      .filter((row) => value(row, 0) && value(row, 1))
      .map((row) => [value(row, 0), value(row, 1)]),
  );
  const rules = matchingRows(sheets["05_Правила_сборки"], /^R\d+$/).map(
    (row) => ({
      id: requiredValue("05_Правила_сборки", row, 0, "rule_id"),
      title: requiredValue("05_Правила_сборки", row, 1, "Блок"),
      content: requiredValue("05_Правила_сборки", row, 2, "Правило"),
    }),
  );
  const examples = matchingRows(sheets["06_Примеры"], /^E\d+$/).map(
    (row) => ({
      stableId: requiredValue("06_Примеры", row, 0, "example_id"),
      selectedAnswers: requiredValue(
        "06_Примеры",
        row,
        1,
        "Выбранные ответы",
      ),
      resultingModules: requiredValue(
        "06_Примеры",
        row,
        2,
        "Итоговые модули",
      ),
      primaryFocus: requiredValue("06_Примеры", row, 3, "Главный фокус"),
      stepsSummary: requiredValue("06_Примеры", row, 4, "Что попадёт в шаги"),
      recommendationsSummary: requiredValue(
        "06_Примеры",
        row,
        5,
        "Пример рекомендаций",
      ),
    }),
  );
  const editingInstructions = sheets["08_Как_редактировать"].rows
    .filter((row) => row.rowNumber >= 2 && row.rowNumber <= 11 && value(row, 0))
    .map((row) => ({
      id: `EDIT_${String(row.rowNumber - 1).padStart(2, "0")}`,
      title: value(row, 0),
      content: [value(row, 1), value(row, 2), value(row, 3)]
        .filter(Boolean)
        .join(" | "),
    }));

  return validateCareerImport({
    source: {
      fileName: basename(filePath),
      sha256: createHash("sha256").update(sourceBuffer).digest("hex").toUpperCase(),
      workbookVersion: readme["Версия"] ?? "unknown",
      recognizedSheets: [...REQUIRED_CAREER_SHEETS],
      readme,
    },
    questions,
    answers,
    mappings,
    modules,
    modifiers,
    recommendations,
    moduleRecommendations,
    entrepreneurStages,
    entrepreneurChallenges,
    rules,
    examples,
    editingInstructions,
  });
}

export interface ImportSummary {
  questions: number;
  answers: number;
  mappings: number;
  modules: number;
  recommendations: number;
  moduleRecommendations: number;
  modifiers: number;
  entrepreneurStages: number;
  entrepreneurChallenges: number;
  rules: number;
  examples: number;
}

export function summarizeCareerImport(config: CareerImport): ImportSummary {
  return {
    questions: config.questions.length,
    answers: config.answers.length,
    mappings: config.mappings.length,
    modules: config.modules.length,
    recommendations: config.recommendations.length,
    moduleRecommendations: config.moduleRecommendations.length,
    modifiers: config.modifiers.length,
    entrepreneurStages: config.entrepreneurStages.length,
    entrepreneurChallenges: config.entrepreneurChallenges.length,
    rules: config.rules.length,
    examples: config.examples.length,
  };
}

type ComparableCollection =
  | "questions"
  | "answers"
  | "modules"
  | "modifiers"
  | "recommendations"
  | "entrepreneurStages"
  | "entrepreneurChallenges";

export type ImportDiff = Record<
  ComparableCollection,
  { added: string[]; changed: string[]; removed: string[] }
>;

export function diffCareerImports(
  previous: CareerImport | null,
  next: CareerImport,
): ImportDiff {
  const collections: ComparableCollection[] = [
    "questions",
    "answers",
    "modules",
    "modifiers",
    "recommendations",
    "entrepreneurStages",
    "entrepreneurChallenges",
  ];

  return Object.fromEntries(
    collections.map((collection) => {
      const before = new Map(
        (previous?.[collection] ?? []).map((item) => [
          item.stableId,
          JSON.stringify(item),
        ]),
      );
      const after = new Map(
        next[collection].map((item) => [item.stableId, JSON.stringify(item)]),
      );
      return [
        collection,
        {
          added: [...after.keys()].filter((id) => !before.has(id)),
          changed: [...after.keys()].filter(
            (id) => before.has(id) && before.get(id) !== after.get(id),
          ),
          removed: [...before.keys()].filter((id) => !after.has(id)),
        },
      ];
    }),
  ) as ImportDiff;
}
