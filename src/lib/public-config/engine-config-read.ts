import "server-only";

import {
  validatePinnedEngineConfig,
  type PinnedEngineConfigRpc,
} from "./engine-config";
import {
  createImmutableVersionCache,
  type ImmutableCacheStatus,
  type ImmutableVersionCache,
} from "./immutable-version-cache";

export type ValidatedEngineConfig = ReturnType<typeof validatePinnedEngineConfig>;

interface PinnedEngineConfigReader {
  getPinnedEngineConfig(configVersionId: string): Promise<PinnedEngineConfigRpc>;
}

export interface EngineConfigReadTiming {
  dataApiReadMs: number;
  validationMs: number;
  totalMs: number;
  cacheStatus: ImmutableCacheStatus;
}

const engineConfigCache = createImmutableVersionCache<ValidatedEngineConfig | null>();

export async function readPinnedEngineConfig(
  configVersionId: string,
  reader: PinnedEngineConfigReader,
  cache: ImmutableVersionCache<ValidatedEngineConfig | null> = engineConfigCache,
): Promise<{ config: ValidatedEngineConfig | null; timing: EngineConfigReadTiming }> {
  const totalStartedAt = Date.now();
  let dataApiReadMs = 0;
  let validationMs = 0;
  const cached = await cache.read(`engine:${configVersionId}`, async () => {
    const readStartedAt = Date.now();
    const compact = await reader.getPinnedEngineConfig(configVersionId);
    dataApiReadMs = Date.now() - readStartedAt;
    if (!compact) return null;

    const validationStartedAt = Date.now();
    const validated = validatePinnedEngineConfig(compact);
    validationMs = Date.now() - validationStartedAt;
    return validated;
  });

  return {
    config: cached.value,
    timing: {
      dataApiReadMs,
      validationMs,
      totalMs: Date.now() - totalStartedAt,
      cacheStatus: cached.status,
    },
  };
}
