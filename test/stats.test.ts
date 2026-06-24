import { describe, it, expect } from "vitest";
import { Cache } from "../js/index";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("Estatísticas", () => {
  it("começa zerado", () => {
    const cache = new Cache();
    expect(cache.stats()).toEqual({
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      expired: 0,
      size: 0,
    });
  });

  it("conta sets", () => {
    const cache = new Cache();
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.stats().sets).toBe(2);
  });

  it("conta hits em leituras bem-sucedidas", () => {
    const cache = new Cache();
    cache.set("a", 1);
    cache.get("a");
    cache.get("a");
    const stats = cache.stats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(0);
  });

  it("conta misses em leituras sem chave", () => {
    const cache = new Cache();
    cache.get("nope");
    cache.get("nada");
    const stats = cache.stats();
    expect(stats.misses).toBe(2);
    expect(stats.hits).toBe(0);
  });

  it("conta deletes", () => {
    const cache = new Cache();
    cache.set("a", 1);
    cache.delete("a");
    cache.delete("a"); // já não existe, não conta
    expect(cache.stats().deletes).toBe(1);
  });

  it("conta expired (leitura preguiçosa de chave vencida)", async () => {
    const cache = new Cache();
    cache.set("a", 1, { ttlSeconds: 1 });
    await sleep(1_100);
    expect(cache.get("a")).toBeNull(); // dispara a expiração preguiçosa
    const stats = cache.stats();
    expect(stats.expired).toBe(1);
    // A leitura de uma chave vencida também conta como miss.
    expect(stats.misses).toBe(1);
  });

  it("size no stats acompanha o tamanho atual", () => {
    const cache = new Cache();
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.stats().size).toBe(2);
    cache.delete("a");
    expect(cache.stats().size).toBe(1);
  });

  it("clear não zera os contadores históricos", () => {
    const cache = new Cache();
    cache.set("a", 1);
    cache.get("a");
    cache.clear();
    const stats = cache.stats();
    expect(stats.size).toBe(0);
    expect(stats.sets).toBe(1);
    expect(stats.hits).toBe(1);
  });
});
