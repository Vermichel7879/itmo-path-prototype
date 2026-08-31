export type ServerTimingMetrics = Record<string, number>;

function roundedDuration(duration: number) {
  return Math.round(Math.max(0, duration) * 10) / 10;
}

export function formatServerTiming(metrics: ServerTimingMetrics) {
  return Object.entries(metrics)
    .filter(([name, duration]) =>
      /^[a-z][a-z0-9_]*$/.test(name) && Number.isFinite(duration),
    )
    .map(([name, duration]) => `${name};dur=${roundedDuration(duration)}`)
    .join(", ");
}

export async function measureServerTiming<T>(
  metrics: ServerTimingMetrics,
  names: string | string[],
  operation: () => Promise<T>,
) {
  const startedAt = Date.now();
  try {
    return await operation();
  } finally {
    const duration = Date.now() - startedAt;
    for (const name of Array.isArray(names) ? names : [names]) {
      metrics[name] = (metrics[name] ?? 0) + duration;
    }
  }
}

export function withServerTiming<T extends Response>(
  response: T,
  requestStartedAt: number,
  metrics: ServerTimingMetrics,
) {
  response.headers.set(
    "Server-Timing",
    formatServerTiming({ total: Date.now() - requestStartedAt, ...metrics }),
  );
  return response;
}
