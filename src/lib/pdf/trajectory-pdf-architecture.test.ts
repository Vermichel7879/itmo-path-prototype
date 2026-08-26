import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("trajectory PDF architecture", () => {
  it("removes the redundant server PDF endpoint", () => {
    expect(existsSync(resolve("src/app/api/trajectory/pdf/route.ts"))).toBe(
      false,
    );
  });

  it("loads the browser PDF runtime only from the download click handler", () => {
    const resultClient = readFileSync(
      resolve("src/components/result/result-client.tsx"),
      "utf8",
    );
    const downloadFunction = resultClient.slice(
      resultClient.indexOf("async function downloadPdf"),
      resultClient.indexOf("if (loadError)"),
    );
    expect(downloadFunction).toMatch(
      /await import\(\s*"@\/lib\/pdf\/trajectory-pdf-browser"\s*\)/,
    );
    expect(downloadFunction).toContain("renderTrajectoryPdfBlob(result)");
    expect(downloadFunction).not.toMatch(
      /^import .*trajectory-pdf|^import .*@react-pdf|^import .*qrcode/m,
    );
    expect(downloadFunction).not.toContain("/api/trajectory/pdf");
    expect(downloadFunction).not.toContain("Object.values(journey.answers)");
  });

  it("accepts only the safe public TrajectoryResult and no engine or repository", () => {
    const browserRenderer = readFileSync(
      resolve("src/lib/pdf/trajectory-pdf-browser.tsx"),
      "utf8",
    );
    expect(browserRenderer).toContain(
      'import type { TrajectoryResult } from "@/lib/rule-engine/types"',
    );
    expect(browserRenderer).not.toMatch(
      /rule-engine\/engine|rankingScores|questionSubtotals|published-career-config|admin|DRAFT|process\.env/,
    );
  });

  it("does not expose engine debug, scores, or module weights in the document", () => {
    const document = readFileSync(
      resolve("src/lib/pdf/trajectory-pdf.tsx"),
      "utf8",
    );
    expect(document).not.toMatch(/TrajectoryDebug|questionSubtotals|rankingScores/);
    expect(document).not.toMatch(/\.scores\b|\.weight\b|\.debug\b/);
  });

  it("uses the replaceable project branding asset in website and PDF headers", () => {
    const websiteHeader = readFileSync(
      resolve("src/components/ui/site-header.tsx"),
      "utf8",
    );
    const browserRenderer = readFileSync(
      resolve("src/lib/pdf/trajectory-pdf-browser.tsx"),
      "utf8",
    );
    expect(websiteHeader).toContain("/brand/itmo-logo-black.jpg");
    expect(browserRenderer).toContain('/brand/itmo-logo-black.jpg');
    expect(browserRenderer).toContain('/fonts/golos-text-variable.ttf');
  });

  it("connects the result download button to the safe in-memory result", () => {
    const resultClient = readFileSync(
      resolve("src/components/result/result-client.tsx"),
      "utf8",
    );
    expect(resultClient).toContain("Скачать PDF");
    expect(resultClient).toContain("renderTrajectoryPdfBlob(result)");
    expect(resultClient).not.toContain("PDF будет доступен в следующей версии");
  });
});
