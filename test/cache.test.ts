import { describe, it, expect, beforeEach } from "vitest";
import { Cache } from "../js/index";

describe("Cache — operações básicas", () => {
  let cache: Cache;

  beforeEach(() => {
    cache = new Cache();
  });

  it("set/get devolve o valor armazenado", () => {
    expect(cache.set("user:1", { id: 1, name: "Roberto" })).toBe(true);
    expect(cache.get("user:1")).toEqual({ id: 1, name: "Roberto" });
  });

  it("get de chave inexistente devolve null", () => {
    expect(cache.get("missing")).toBeNull();
  });

  it("guarda diferentes tipos de valores", () => {
    cache.set("string", "hello");
    cache.set("number", 42);
    cache.set("bool", true);
    cache.set("array", [1, 2, 3]);
    cache.set("nested", { a: { b: [1, { c: 2 }] } });

    expect(cache.get("string")).toBe("hello");
    expect(cache.get("number")).toBe(42);
    expect(cache.get("bool")).toBe(true);
    expect(cache.get("array")).toEqual([1, 2, 3]);
    expect(cache.get("nested")).toEqual({ a: { b: [1, { c: 2 }] } });
  });

  it("exists reflete a presença da chave", () => {
    expect(cache.exists("k")).toBe(false);
    cache.set("k", 1);
    expect(cache.exists("k")).toBe(true);
  });

  it("delete remove a chave e devolve true/false", () => {
    cache.set("k", 1);
    expect(cache.delete("k")).toBe(true);
    expect(cache.exists("k")).toBe(false);
    expect(cache.delete("k")).toBe(false);
  });

  it("clear esvazia o cache", () => {
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.size()).toBe(2);
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get("a")).toBeNull();
  });

  it("size reflete o número de chaves", () => {
    expect(cache.size()).toBe(0);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.size()).toBe(2);
  });

  it("sobrescrever uma chave existente não aumenta o size", () => {
    cache.set("a", 1);
    cache.set("a", 2);
    expect(cache.size()).toBe(1);
    expect(cache.get("a")).toBe(2);
  });

  it("get tipado preserva o formato (genérico)", () => {
    interface User {
      id: number;
      name: string;
    }
    cache.set<User>("user:7", { id: 7, name: "Ana" });
    const user = cache.get<User>("user:7");
    expect(user?.name).toBe("Ana");
  });

  it("respeita maxSize rejeitando chaves novas quando cheio", () => {
    const small = new Cache({ maxSize: 2 });
    expect(small.set("a", 1)).toBe(true);
    expect(small.set("b", 2)).toBe(true);
    // cache cheio: chave nova é rejeitada...
    expect(small.set("c", 3)).toBe(false);
    // ...mas sobrescrever uma existente continua permitido.
    expect(small.set("a", 10)).toBe(true);
    expect(small.get("a")).toBe(10);
    expect(small.get("c")).toBeNull();
  });

  it("armazena objetos grandes sem corromper os dados", () => {
    const big = {
      items: Array.from({ length: 10_000 }, (_, i) => ({
        i,
        label: `item-${i}`,
      })),
    };
    expect(cache.set("big", big)).toBe(true);
    const out = cache.get<typeof big>("big");
    expect(out?.items.length).toBe(10_000);
    expect(out?.items[9_999]).toEqual({ i: 9999, label: "item-9999" });
  });
});
