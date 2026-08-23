import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { strToU8, zipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";

import { readXlsxWorkbook } from "./ooxml-reader";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("OOXML reader", () => {
  it("reads prefixed workbook XML and inline strings", async () => {
    const directory = await mkdtemp(join(tmpdir(), "career-ooxml-"));
    temporaryDirectories.push(directory);
    const filePath = join(directory, "fixture.xlsx");
    const archive = zipSync({
      "xl/workbook.xml": strToU8(
        '<?xml version="1.0"?><x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheets><x:sheet name="Данные" sheetId="1" r:id="R1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></x:sheets></x:workbook>',
      ),
      "xl/_rels/workbook.xml.rels": strToU8(
        '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="R1" Target="worksheets/sheet1.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/></Relationships>',
      ),
      "xl/worksheets/sheet1.xml": strToU8(
        '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>header</t></is></c><c r="B1" t="inlineStr"><is><t>Привет</t></is></c></row><row r="2"><c r="A2"><v>42</v></c></row></sheetData></worksheet>',
      ),
    });
    await writeFile(filePath, archive);

    const workbook = await readXlsxWorkbook(filePath);

    expect(workbook.sheets.get("Данные")?.rows).toEqual([
      { rowNumber: 1, values: ["header", "Привет"] },
      { rowNumber: 2, values: ["42"] },
    ]);
  });
});
