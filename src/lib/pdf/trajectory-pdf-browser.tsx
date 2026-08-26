"use client";

import { pdf } from "@react-pdf/renderer";

import type { TrajectoryResult } from "@/lib/rule-engine/types";

import { prepareTrajectoryPdfData } from "./trajectory-pdf-data";
import { TrajectoryPdfDocument } from "./trajectory-pdf";

function publicAssetUrl(pathname: string) {
  return new URL(pathname, window.location.origin).toString();
}

export async function renderTrajectoryPdfBlob(result: TrajectoryResult) {
  const data = await prepareTrajectoryPdfData(result);
  return pdf(
    <TrajectoryPdfDocument
      data={data}
      assets={{
        fontSrc: publicAssetUrl("/fonts/golos-text-variable.ttf"),
        logoSrc: publicAssetUrl("/brand/itmo-logo-black.jpg"),
      }}
    />,
  ).toBlob();
}
