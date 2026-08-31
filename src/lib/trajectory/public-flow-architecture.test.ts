import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("public trajectory flow architecture", () => {
  it("keeps admin Preview isolated from persistent trajectory sessions", () => {
    const preview = readFileSync(resolve("src/app/api/admin/preview/route.ts"), "utf8");
    expect(preview).not.toContain("trajectoryDataApi");
    expect(preview).not.toContain("public_start_trajectory_session");
    expect(preview).toContain('"MASTER"');
  });

  it("does not expose a public session lookup by ISU", () => {
    const start = readFileSync(resolve("src/app/api/trajectory-sessions/route.ts"), "utf8");
    expect(start).toContain("export async function POST");
    expect(start).not.toContain("export async function GET");
    expect(start).not.toMatch(/by[-_/]isu/i);
  });

  it("persists each question before moving forward and completes through one atomic RPC", () => {
    const client = readFileSync(resolve("src/components/questionnaire/questionnaire-client.tsx"), "utf8");
    const route = readFileSync(resolve("src/app/api/trajectory/route.ts"), "utf8");
    expect(client).toContain("/api/trajectory-sessions/answers");
    expect(route).toContain("trajectoryDataApi.complete");
    expect(route).toContain("buildTrajectoryCompletionPayload");
  });

  it("reads the exact pinned engine configuration through Data API", () => {
    const route = readFileSync(resolve("src/app/api/trajectory/route.ts"), "utf8");
    expect(route).toContain("getPinnedEngineConfig(session.configVersionId)");
    expect(route).not.toContain("getPublishedCareerConfigById");
    expect(route).toContain("validatePinnedEngineConfig");
  });
});
