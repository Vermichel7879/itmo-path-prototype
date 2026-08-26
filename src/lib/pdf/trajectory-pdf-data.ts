import QRCode from "qrcode";

import type {
  PublicTrajectoryRecommendation,
  TrajectoryResult,
} from "@/lib/rule-engine/types";

export const PDF_RESOURCE_ID_WHITELIST = new Set([
  "CKO_CONSULT",
  "GEN_MARKET_SCAN",
]);

export const PDF_RESOURCE_TYPE_WHITELIST = new Set([
  "EVENT",
  "FACULTY",
  "CLUB",
]);

export interface TrajectoryPdfResource
  extends PublicTrajectoryRecommendation {
  href: string | null;
  qrDataUrl: string | null;
}

export interface TrajectoryPdfData extends TrajectoryResult {
  resources: TrajectoryPdfResource[];
  paceLabel: string;
}

export function isPdfResourceWhitelisted(
  recommendation: PublicTrajectoryRecommendation,
) {
  return (
    PDF_RESOURCE_ID_WHITELIST.has(recommendation.id) ||
    PDF_RESOURCE_TYPE_WHITELIST.has(recommendation.type)
  );
}

export function pdfPaceLabel(key: string | null | undefined) {
  const normalized = key?.replace(/^pace_/, "") ?? "";
  return (
    {
      light: "Спокойный темп",
      normal: "Ровный темп",
      active: "Активный темп",
      intensive: "Интенсивный темп",
    }[normalized] ?? "Индивидуальный темп"
  );
}

export function compactPdfPreviewText(value: string, maxLength = 82) {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length <= maxLength) return text;
  const candidate = text.slice(0, maxLength - 1);
  const lastSpace = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, Math.max(lastSpace, 1)).trim()}…`;
}

function safePdfResourceUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

async function pdfResource(
  recommendation: PublicTrajectoryRecommendation,
): Promise<TrajectoryPdfResource> {
  const href =
    isPdfResourceWhitelisted(recommendation) && recommendation.url
      ? safePdfResourceUrl(recommendation.url)
      : null;
  const qrDataUrl = href
    ? await QRCode.toDataURL(href, {
        errorCorrectionLevel: "M",
        margin: 4,
        width: 320,
        color: { dark: "#000000", light: "#ffffff" },
      })
    : null;
  return { ...recommendation, href, qrDataUrl };
}

export async function prepareTrajectoryPdfData(
  result: TrajectoryResult,
): Promise<TrajectoryPdfData> {
  return {
    ...result,
    supportModules: result.supportModules.slice(0, 2),
    resources: await Promise.all(result.recommendations.slice(0, 3).map(pdfResource)),
    paceLabel: pdfPaceLabel(result.pace?.key),
  };
}
