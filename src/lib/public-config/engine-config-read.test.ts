import { describe, expect, it, vi } from "vitest";

import seed from "@/lib/db/seed/career-config-v2.json";
import { validatePublishableCareerSnapshot } from "@/lib/db/publish/publish-validation";

vi.mock("server-only", () => ({}));

import {
  readPinnedEngineConfig,
  type ValidatedEngineConfig,
} from "./engine-config-read";
import type { PinnedEngineConfigRpc } from "./engine-config";
import { createImmutableVersionCache } from "./immutable-version-cache";

function pinnedEngineResponse(configVersionId: string): NonNullable<PinnedEngineConfigRpc> {
  const config = validatePublishableCareerSnapshot(structuredClone(seed));
  return {
    configVersionId,
    config: {
      questions: config.questions,
      answers: config.answers,
      mappings: config.mappings,
      modules: config.modules,
      modifiers: config.modifiers,
      recommendations: config.recommendations,
      moduleRecommendations: config.moduleRecommendations,
      opportunities: config.opportunities,
      entrepreneurStages: config.entrepreneurStages,
      entrepreneurChallenges: config.entrepreneurChallenges,
      engineRules: config.engineRules,
    },
  };
}

describe("cached pinned engine config read", () => {
  it("validates on MISS and reuses the exact pinned version on HIT", async () => {
    const oldId = "00000000-0000-4000-8000-000000000123";
    const newerId = "00000000-0000-4000-8000-000000000999";
    const reader = {
      getPinnedEngineConfig: vi.fn(async (id: string) => pinnedEngineResponse(id)),
    };
    const cache = createImmutableVersionCache<ValidatedEngineConfig | null>();

    const first = await readPinnedEngineConfig(oldId, reader, cache);
    const newer = await readPinnedEngineConfig(newerId, reader, cache);
    const oldAgain = await readPinnedEngineConfig(oldId, reader, cache);

    expect(first.timing.cacheStatus).toBe("MISS");
    expect(oldAgain.timing.cacheStatus).toBe("HIT");
    expect(oldAgain.config?.configVersionId).toBe(oldId);
    expect(newer.config?.configVersionId).toBe(newerId);
    expect(reader.getPinnedEngineConfig).toHaveBeenCalledTimes(2);
  });
});
