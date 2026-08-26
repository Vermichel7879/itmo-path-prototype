import { readFileSync } from "node:fs";
import path from "node:path";

import { renderToBuffer } from "@react-pdf/renderer";

import type { TrajectoryPdfData } from "../src/lib/pdf/trajectory-pdf-data";
import { TrajectoryPdfDocument } from "../src/lib/pdf/trajectory-pdf";

const logoPath = path.join(
  process.cwd(),
  "public",
  "brand",
  "itmo-logo-black.jpg",
);
const fontPath = path.join(
  process.cwd(),
  "public",
  "fonts",
  "golos-text-variable.ttf",
);
const logoDataUrl = `data:image/jpeg;base64,${readFileSync(logoPath).toString("base64")}`;

export function renderTrajectoryPdfSample(data: TrajectoryPdfData) {
  return renderToBuffer(
    <TrajectoryPdfDocument
      data={data}
      assets={{ fontSrc: fontPath, logoSrc: logoDataUrl }}
    />,
  );
}
