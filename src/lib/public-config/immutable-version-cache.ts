import "server-only";

export type ImmutableCacheStatus = "HIT" | "MISS" | "COALESCED";

export interface ImmutableCacheRead<T> {
  value: T;
  status: ImmutableCacheStatus;
}

export interface ImmutableVersionCache<T> {
  read(key: string, load: () => Promise<T>): Promise<ImmutableCacheRead<T>>;
  clear(): void;
}

export function createImmutableVersionCache<T>(maxEntries = 64): ImmutableVersionCache<T> {
  const values = new Map<string, T>();
  const inFlight = new Map<string, Promise<T>>();

  function remember(key: string, value: T) {
    if (value === null || value === undefined) return;
    values.delete(key);
    values.set(key, value);
    while (values.size > maxEntries) {
      const oldestKey = values.keys().next().value;
      if (oldestKey === undefined) break;
      values.delete(oldestKey);
    }
  }

  return {
    async read(key, load) {
      if (values.has(key)) {
        return { value: values.get(key) as T, status: "HIT" };
      }

      const pending = inFlight.get(key);
      if (pending) {
        return { value: await pending, status: "COALESCED" };
      }

      const loading = load()
        .then((value) => {
          remember(key, value);
          return value;
        })
        .finally(() => {
          inFlight.delete(key);
        });
      inFlight.set(key, loading);
      return { value: await loading, status: "MISS" };
    },
    clear() {
      values.clear();
      inFlight.clear();
    },
  };
}
