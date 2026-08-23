import { readFile } from "node:fs/promises";
import { posix } from "node:path";

import { XMLParser } from "fast-xml-parser";
import { unzipSync } from "fflate";

type XmlNode = Record<string, unknown>;

export interface WorkbookRow {
  rowNumber: number;
  values: string[];
}

export interface WorkbookSheet {
  name: string;
  rows: WorkbookRow[];
}

export interface WorkbookData {
  sheets: Map<string, WorkbookSheet>;
}

const xmlParser = new XMLParser({
  attributeNamePrefix: "@",
  ignoreAttributes: false,
  parseAttributeValue: false,
  parseTagValue: false,
  removeNSPrefix: true,
  trimValues: false,
});

const textDecoder = new TextDecoder("utf-8");

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function asObject(value: unknown, context: string): XmlNode {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Некорректная OOXML-структура: ${context}`);
  }
  return value as XmlNode;
}

function readXml(files: Record<string, Uint8Array>, path: string): XmlNode {
  const entry = files[path];
  if (!entry) throw new Error(`В XLSX отсутствует обязательный файл ${path}`);
  return asObject(xmlParser.parse(textDecoder.decode(entry)), path);
}

function attribute(node: XmlNode, name: string, context: string): string {
  const value = node[`@${name}`];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`В ${context} отсутствует атрибут ${name}`);
  }
  return value;
}

function nodeText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(nodeText).join("");
  if (typeof value !== "object") return "";

  const node = value as XmlNode;
  if (node["#text"] !== undefined) return nodeText(node["#text"]);
  if (node.t !== undefined) return nodeText(node.t);
  if (node.r !== undefined) return nodeText(node.r);
  return "";
}

function sharedStrings(files: Record<string, Uint8Array>): string[] {
  if (!files["xl/sharedStrings.xml"]) return [];
  const document = readXml(files, "xl/sharedStrings.xml");
  if (!document.sst || typeof document.sst !== "object") return [];
  const table = asObject(document.sst, "xl/sharedStrings.xml/sst");
  return asArray(table.si).map(nodeText);
}

function columnIndex(cellReference: string): number {
  const letters = cellReference.match(/^[A-Z]+/i)?.[0];
  if (!letters) throw new Error(`Некорректная координата ячейки ${cellReference}`);

  return [...letters.toUpperCase()].reduce(
    (result, letter) => result * 26 + letter.charCodeAt(0) - 64,
    0,
  );
}

function cellValue(cell: XmlNode, strings: string[], context: string): string {
  const type = typeof cell["@t"] === "string" ? cell["@t"] : undefined;

  if (type === "inlineStr") return nodeText(cell.is);
  if (type === "str") return nodeText(cell.v);
  if (type === "b") return nodeText(cell.v) === "1" ? "TRUE" : "FALSE";

  const raw = nodeText(cell.v);
  if (type !== "s") return raw;

  const index = Number.parseInt(raw, 10);
  const value = strings[index];
  if (!Number.isInteger(index) || value === undefined) {
    throw new Error(`${context}: неверная ссылка на shared string ${raw}`);
  }
  return value;
}

function worksheetRows(
  document: XmlNode,
  strings: string[],
  sheetName: string,
): WorkbookRow[] {
  const worksheet = asObject(document.worksheet, `${sheetName}/worksheet`);
  const sheetData = asObject(worksheet.sheetData, `${sheetName}/sheetData`);

  return asArray(sheetData.row).map((rawRow, fallbackIndex) => {
    const row = asObject(rawRow, `${sheetName}/row`);
    const declaredRow = Number.parseInt(String(row["@r"] ?? ""), 10);
    const rowNumber = Number.isInteger(declaredRow)
      ? declaredRow
      : fallbackIndex + 1;
    const values: string[] = [];

    for (const rawCell of asArray(row.c)) {
      const cell = asObject(rawCell, `${sheetName}!row${rowNumber}/cell`);
      const reference = attribute(
        cell,
        "r",
        `${sheetName}!row${rowNumber}/cell`,
      );
      const index = columnIndex(reference);
      values[index - 1] = cellValue(
        cell,
        strings,
        `${sheetName}!${reference}`,
      );
    }

    return { rowNumber, values: values.map((value) => value ?? "") };
  });
}

function worksheetPath(target: string): string {
  const normalized = target.replace(/\\/g, "/");
  if (normalized.startsWith("/")) return normalized.slice(1);
  if (normalized.startsWith("xl/")) return normalized;
  return posix.normalize(posix.join("xl", normalized));
}

export async function readXlsxWorkbook(filePath: string): Promise<WorkbookData> {
  const archive = unzipSync(new Uint8Array(await readFile(filePath)));
  const workbookDocument = readXml(archive, "xl/workbook.xml");
  const relationshipsDocument = readXml(
    archive,
    "xl/_rels/workbook.xml.rels",
  );
  const workbook = asObject(workbookDocument.workbook, "xl/workbook.xml/workbook");
  const sheetsNode = asObject(workbook.sheets, "xl/workbook.xml/sheets");
  const relationships = asObject(
    relationshipsDocument.Relationships,
    "xl/_rels/workbook.xml.rels/Relationships",
  );
  const relationTargets = new Map(
    asArray(relationships.Relationship).map((rawRelationship) => {
      const relationship = asObject(rawRelationship, "workbook relationship");
      return [
        attribute(relationship, "Id", "workbook relationship"),
        attribute(relationship, "Target", "workbook relationship"),
      ];
    }),
  );
  const strings = sharedStrings(archive);
  const sheets = new Map<string, WorkbookSheet>();

  for (const rawSheet of asArray(sheetsNode.sheet)) {
    const sheet = asObject(rawSheet, "workbook sheet");
    const name = attribute(sheet, "name", "workbook sheet");
    const relationId = attribute(sheet, "id", `workbook sheet ${name}`);
    const target = relationTargets.get(relationId);
    if (!target) {
      throw new Error(`Для листа ${name} отсутствует relationship ${relationId}`);
    }

    const path = worksheetPath(target);
    const document = readXml(archive, path);
    sheets.set(name, {
      name,
      rows: worksheetRows(document, strings, name),
    });
  }

  return { sheets };
}
