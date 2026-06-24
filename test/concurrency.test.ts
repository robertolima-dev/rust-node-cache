import { describe, it, expect } from "vitest";
import { Cache } from "../js/index";

/**
 * O núcleo Rust usa um DashMap (concorrente, com sharding por lock). Embora o
 * event loop do Node seja single-threaded, exercitamos muitas operações
 * intercaladas/assíncronas para validar consistência sob alta concorrência
 * lógica — sem corrupção de estado nem contadores incoerentes.
 */
describe("Concorrência", () => {
  it("mantém consistência sob muitas escritas/leituras intercaladas", async () => {
    const cache = new Cache();
    const N = 5_000;

    await Promise.all(
      Array.from({ length: N }, (_, i) =>
        Promise.resolve().then(() => {
          cache.set(`key:${i}`, { i });
        }),
      ),
    );

    expect(cache.size()).toBe(N);

    const reads = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        Promise.resolve().then(() => cache.get<{ i: number }>(`key:${i}`)),
      ),
    );

    reads.forEach((value, i) => {
      expect(value).toEqual({ i });
    });

    const stats = cache.stats();
    expect(stats.sets).toBe(N);
    expect(stats.hits).toBe(N);
    expect(stats.misses).toBe(0);
  });

  it("escritas concorrentes na MESMA chave deixam o cache consistente", async () => {
    const cache = new Cache();
    const N = 2_000;

    await Promise.all(
      Array.from({ length: N }, (_, i) =>
        Promise.resolve().then(() => cache.set("hot", i)),
      ),
    );

    // Apenas uma chave deve existir e o valor precisa ser um dos escritos.
    expect(cache.size()).toBe(1);
    const value = cache.get<number>("hot");
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(N);
  });

  it("delete e set concorrentes não corrompem o size", async () => {
    const cache = new Cache();
    const N = 3_000;

    for (let i = 0; i < N; i++) cache.set(`k:${i}`, i);

    await Promise.all(
      Array.from({ length: N }, (_, i) =>
        Promise.resolve().then(() => {
          if (i % 2 === 0) cache.delete(`k:${i}`);
        }),
      ),
    );

    expect(cache.size()).toBe(N / 2);
  });
});
