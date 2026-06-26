/**
 * rust-node-cache — API pública (TypeScript).
 *
 * "Ultra-fast in-memory cache powered by Rust."
 *
 * Esta camada é um wrapper fino e tipado sobre a classe `Cache` nativa gerada
 * pelo Rust/napi-rs. Por que envolver em vez de re-exportar direto?
 *  - permite **genéricos** ergonômicos: `cache.get<User>("user:1")`;
 *  - normaliza `undefined`/`null` para sempre devolver `null` num miss;
 *  - dá um único lugar para JSDoc e para evoluir a API sem quebrar o core Rust.
 *
 * O custo é uma chamada de função extra por operação — desprezível frente ao
 * trabalho real (serialização + acesso ao DashMap) que acontece no Rust.
 */

// Namespace import: funciona igual em CommonJS e ESM ao consumir o addon nativo
// (que é um módulo CJS gerado pelo napi-rs).
import * as native from "../binding.js";

/** Estratégia de evicção quando `maxSize` é atingido. */
export type EvictionPolicy = "reject" | "lru";

/** Opções do construtor do cache. */
export interface CacheOptions {
  /**
   * Limite máximo de chaves. O que acontece ao atingir depende de
   * `evictionPolicy`. Sem valor => cache ilimitado.
   */
  maxSize?: number;
  /**
   * Política ao atingir `maxSize` numa chave **nova**:
   * - `"reject"` (padrão): `set` retorna `false` (sobrescrever continua ok);
   * - `"lru"`: remove a entrada menos recentemente usada e prossegue.
   */
  evictionPolicy?: EvictionPolicy;
  /**
   * Se definido (> 0), liga uma thread que varre entradas expiradas a cada
   * N segundos (expiração em background, além da preguiçosa por acesso).
   */
  cleanupIntervalSeconds?: number;
}

/** Opções por operação de escrita. */
export interface SetOptions {
  /** Tempo de vida em segundos. Ausente => a entrada não expira por tempo. */
  ttlSeconds?: number;
}

/** Estatísticas acumuladas do cache (mais o tamanho atual). */
export interface CacheStats {
  /** Leituras que encontraram uma entrada válida. */
  hits: number;
  /** Leituras sem chave válida (ausente ou expirada). */
  misses: number;
  /** Total de escritas (`set`). */
  sets: number;
  /** Total de remoções explícitas (`delete`). */
  deletes: number;
  /** Total de entradas removidas por expiração. */
  expired: number;
  /** Total de entradas removidas por evicção (política LRU ao atingir `maxSize`). */
  evicted: number;
  /** Número de chaves armazenadas agora. */
  size: number;
}

/**
 * Cache em memória ultrarrápido com núcleo em Rust (DashMap + contadores
 * atômicos). Thread-safe e com suporte a TTL por entrada.
 *
 * @example
 * ```ts
 * import { Cache } from "rust-node-cache";
 *
 * const cache = new Cache();
 * cache.set("user:1", { id: 1, name: "Roberto" });
 * cache.get<{ id: number; name: string }>("user:1"); // { id: 1, name: "Roberto" }
 * ```
 */
export class Cache {
  /** Instância da classe nativa (Rust). */
  private readonly native: native.Cache;

  constructor(options: CacheOptions = {}) {
    // Só repassamos um objeto de opções ao Rust quando há algo relevante.
    const hasOptions =
      options.maxSize !== undefined ||
      options.evictionPolicy !== undefined ||
      options.cleanupIntervalSeconds !== undefined;
    this.native = hasOptions
      ? new native.Cache({
          maxSize: options.maxSize,
          evictionPolicy: options.evictionPolicy,
          cleanupIntervalSeconds: options.cleanupIntervalSeconds,
        })
      : new native.Cache();
  }

  /** A política de evicção ativa: `"reject"` ou `"lru"`. */
  get evictionPolicy(): EvictionPolicy {
    return this.native.evictionPolicy as EvictionPolicy;
  }

  /**
   * Armazena (ou sobrescreve) um valor. O valor é serializado como JSON no core.
   *
   * @returns `true` em sucesso; `false` se `maxSize` foi atingido e a chave é nova.
   */
  set<T>(key: string, value: T, options?: SetOptions): boolean {
    return this.native.set(key, value as unknown as object, options);
  }

  /**
   * Lê um valor. Aplica expiração preguiçosa: chaves vencidas contam como miss.
   *
   * @returns o valor desserializado, ou `null` se ausente/expirado.
   */
  get<T = unknown>(key: string): T | null {
    const value = this.native.get(key);
    return value === null || value === undefined ? null : (value as T);
  }

  /** Remove uma chave. Retorna `true` se ela existia. */
  delete(key: string): boolean {
    return this.native.delete(key);
  }

  /** Indica se a chave existe e está válida (não expirada). */
  exists(key: string): boolean {
    return this.native.exists(key);
  }

  /** Esvazia o cache (não zera os contadores históricos de `stats`). */
  clear(): void {
    this.native.clear();
  }

  /** Número de chaves armazenadas no momento. */
  size(): number {
    return this.native.size();
  }

  /**
   * Varre e remove todas as entradas expiradas de uma só vez.
   *
   * @returns quantas entradas foram removidas.
   */
  cleanupExpired(): number {
    return this.native.cleanupExpired();
  }

  /** Retorna as estatísticas acumuladas + o tamanho atual. */
  stats(): CacheStats {
    return this.native.stats();
  }
}
