import { describe, it, expect } from "vitest";
import { Cache } from "../js/index";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("Cache — evictionPolicy", () => {
  it("usa reject por padrão", () => {
    const cache = new Cache({ maxSize: 2 });
    expect(cache.evictionPolicy).toBe("reject");
  });

  it("expõe lru via getter", () => {
    const cache = new Cache({ maxSize: 2, evictionPolicy: "lru" });
    expect(cache.evictionPolicy).toBe("lru");
  });

  it("rejeita uma política desconhecida", () => {
    expect(() => new Cache({ maxSize: 2, evictionPolicy: "lfu" })).toThrow();
  });

  it("reject: bloqueia chave nova quando cheio", () => {
    const cache = new Cache({ maxSize: 2, evictionPolicy: "reject" });
    expect(cache.set("a", 1)).toBe(true);
    expect(cache.set("b", 2)).toBe(true);
    expect(cache.set("c", 3)).toBe(false); // cheio
    expect(cache.size()).toBe(2);
    expect(cache.stats().evicted).toBe(0);
  });
});

describe("Cache — LRU eviction", () => {
  it("remove a entrada menos recentemente usada", async () => {
    const cache = new Cache({ maxSize: 2, evictionPolicy: "lru" });
    cache.set("a", 1);
    cache.set("b", 2);

    // Acessa "a" mais tarde: "b" passa a ser a menos recentemente usada.
    await sleep(10);
    expect(cache.get("a")).toBe(1);

    // Insere "c": deve evictar "b" (LRU), mantendo "a" e "c".
    cache.set("c", 3);
    expect(cache.size()).toBe(2);
    expect(cache.stats().evicted).toBe(1);
    expect(cache.get("b")).toBeNull();
    expect(cache.get("a")).toBe(1);
    expect(cache.get("c")).toBe(3);
  });

  it("sobrescrever chave existente não causa evicção", () => {
    const cache = new Cache({ maxSize: 2, evictionPolicy: "lru" });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("a", 10); // overwrite, não é chave nova
    expect(cache.size()).toBe(2);
    expect(cache.stats().evicted).toBe(0);
    expect(cache.get("a")).toBe(10);
  });
});

describe("Cache — background expiration", () => {
  it(
    "varre entradas expiradas automaticamente",
    async () => {
      const cache = new Cache({ cleanupIntervalSeconds: 1 });
      cache.set("a", 1, { ttlSeconds: 1 });
      expect(cache.size()).toBe(1);

      // Sem chamar cleanupExpired(): a thread de fundo deve coletar a entrada
      // depois que o TTL (1s) vence e o sweeper (1s) roda.
      await sleep(2500);

      expect(cache.size()).toBe(0);
      expect(cache.stats().expired).toBeGreaterThanOrEqual(1);
    },
    10_000,
  );
});
