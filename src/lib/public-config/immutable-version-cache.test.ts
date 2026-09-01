import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createImmutableVersionCache,
  ImmutableCacheLoadError,
} from "./immutable-version-cache";

describe("immutable published version cache", () => {
  it("returns MISS first and HIT for the same version afterward", async () => {
    const cache = createImmutableVersionCache<string>();
    const load = vi.fn().mockResolvedValue("pinned-v1");

    await expect(cache.read("engine:v1", load)).resolves.toEqual({
      value: "pinned-v1",
      status: "MISS",
    });
    await expect(cache.read("engine:v1", load)).resolves.toEqual({
      value: "pinned-v1",
      status: "HIT",
    });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("keeps different config versions in separate entries", async () => {
    const cache = createImmutableVersionCache<string>();

    await cache.read("engine:old", async () => "old-published");
    await cache.read("engine:new", async () => "new-published");

    await expect(cache.read("engine:old", async () => "wrong")).resolves.toEqual({
      value: "old-published",
      status: "HIT",
    });
  });

  it("does not cache a failed read", async () => {
    const cache = createImmutableVersionCache<string>();
    const load = vi.fn()
      .mockRejectedValueOnce(new Error("transport"))
      .mockResolvedValueOnce("recovered");

    await expect(cache.read("engine:v1", load)).rejects.toMatchObject({
      cacheStatus: "MISS",
      originalError: expect.objectContaining({ message: "transport" }),
    });
    await expect(cache.read("engine:v1", load)).resolves.toEqual({
      value: "recovered",
      status: "MISS",
    });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent misses for the same version", async () => {
    const cache = createImmutableVersionCache<string>();
    let resolveLoad!: (value: string) => void;
    const load = vi.fn(() => new Promise<string>((resolve) => {
      resolveLoad = resolve;
    }));

    const first = cache.read("engine:v1", load);
    const second = cache.read("engine:v1", load);
    resolveLoad("shared");

    await expect(first).resolves.toEqual({ value: "shared", status: "MISS" });
    await expect(second).resolves.toEqual({ value: "shared", status: "COALESCED" });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("preserves MISS versus COALESCED when one shared load fails", async () => {
    const cache = createImmutableVersionCache<string>();
    let rejectLoad!: (error: Error) => void;
    const load = vi.fn(() => new Promise<string>((_resolve, reject) => {
      rejectLoad = reject;
    }));

    const owner = cache.read("engine:v1", load);
    const follower = cache.read("engine:v1", load);
    rejectLoad(new Error("transport"));

    await expect(owner).rejects.toEqual(expect.objectContaining({
      name: "ImmutableCacheLoadError",
      cacheStatus: "MISS",
    } satisfies Partial<ImmutableCacheLoadError>));
    await expect(follower).rejects.toEqual(expect.objectContaining({
      name: "ImmutableCacheLoadError",
      cacheStatus: "COALESCED",
    } satisfies Partial<ImmutableCacheLoadError>));
    expect(load).toHaveBeenCalledTimes(1);
  });
});
