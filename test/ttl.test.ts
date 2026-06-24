import { describe, it, expect } from "vitest";
import { Cache } from "../js/index";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("TTL", () => {
  it("uma entrada sem TTL não expira", async () => {
    const cache = new Cache();
    cache.set("permanent", { ok: true });
    await sleep(50);
    expect(cache.get("permanent")).toEqual({ ok: true });
  });

  it("uma entrada com TTL expira após o prazo (expiração preguiçosa)", async () => {
    const cache = new Cache();
    cache.set("session:123", { token: "abc" }, { ttlSeconds: 1 });

    // Antes de expirar continua acessível.
    expect(cache.get("session:123")).toEqual({ token: "abc" });

    // Após 1.1s deve sumir.
    await sleep(1_100);
    expect(cache.get("session:123")).toBeNull();
  });

  it("exists também respeita a expiração", async () => {
    const cache = new Cache();
    cache.set("k", 1, { ttlSeconds: 1 });
    expect(cache.exists("k")).toBe(true);
    await sleep(1_100);
    expect(cache.exists("k")).toBe(false);
  });

  it("cleanupExpired remove entradas vencidas e devolve a contagem", async () => {
    const cache = new Cache();
    cache.set("a", 1, { ttlSeconds: 1 });
    cache.set("b", 2, { ttlSeconds: 1 });
    cache.set("c", 3); // sem TTL, deve permanecer

    expect(cache.size()).toBe(3);
    await sleep(1_100);

    // As expiradas ainda contam no size até serem varridas (expiração preguiçosa).
    const removed = cache.cleanupExpired();
    expect(removed).toBe(2);
    expect(cache.size()).toBe(1);
    expect(cache.get("c")).toBe(3);
  });

  it("sobrescrever uma chave renova o TTL", async () => {
    const cache = new Cache();
    cache.set("k", 1, { ttlSeconds: 1 });
    await sleep(600);
    // Renova o prazo.
    cache.set("k", 2, { ttlSeconds: 1 });
    await sleep(600);
    // Já se passaram 1.2s desde o primeiro set, mas só 0.6s desde o segundo.
    expect(cache.get("k")).toBe(2);
  });
});
