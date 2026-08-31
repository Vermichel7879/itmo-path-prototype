import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PublicTrajectoryRecommendation } from "@/lib/rule-engine/types";
import { RecommendationCards, recommendationListClassName } from "./recommendation-cards";

function recommendations(count: number): PublicTrajectoryRecommendation[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `REC${index + 1}`,
    type: "GENERAL",
    title: `Recommendation ${index + 1}`,
    description: `Full long description ${index + 1}`,
    url: index === 0 ? "https://example.com/resource" : null,
  }));
}

describe("public recommendation cards", () => {
  it("keeps the full description and resource inside the expandable area", () => {
    const html = renderToStaticMarkup(<RecommendationCards recommendations={recommendations(1)} />);
    const summary = html.match(/<summary>[\s\S]*?<\/summary>/)?.[0] ?? "";
    expect(summary).toContain("Recommendation 1");
    expect(summary).toContain("Практический материал");
    expect(summary).toContain("Подробнее");
    expect(summary).toContain("Скрыть");
    expect(summary).not.toContain("Full long description 1");
    expect(summary).not.toContain("example.com/resource");
    expect(html.indexOf("Full long description 1")).toBeGreaterThan(html.indexOf("</summary>"));
    expect(html.indexOf("example.com/resource")).toBeGreaterThan(html.indexOf("</summary>"));
  });

  it("uses all available columns for one, two, or three recommendations", () => {
    expect(recommendationListClassName(1)).toContain("recommendation-list--1");
    expect(recommendationListClassName(2)).toContain("recommendation-list--2");
    expect(recommendationListClassName(3)).toContain("recommendation-list--3");
    for (const count of [1, 2, 3]) {
      expect(renderToStaticMarkup(<RecommendationCards recommendations={recommendations(count)} />))
        .toContain(`recommendation-list--${count}`);
    }
  });
});
