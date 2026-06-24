/**
 * Integração com Express: cache de respostas JSON.
 *
 * Uso:
 *   import { Cache } from "rust-node-cache";
 *   import { cacheMiddleware } from "rust-node-cache/express";
 *
 *   const cache = new Cache();
 *   app.get("/users/:id", cacheMiddleware({ cache, ttlSeconds: 60 }), handler);
 *
 * O middleware intercepta `res.json`: num HIT responde direto do cache; num
 * MISS deixa o handler rodar e guarda o corpo da resposta (apenas em 2xx).
 */

import type { Request, Response, NextFunction } from "express";
import type { Cache } from "./index";

export interface CacheMiddlewareOptions {
  /** Instância de cache a usar. */
  cache: Cache;
  /** TTL aplicado às respostas guardadas (em segundos). */
  ttlSeconds?: number;
  /** Métodos HTTP elegíveis para cache. Padrão: `["GET"]`. */
  methods?: string[];
  /** Gera a chave de cache a partir da requisição. Padrão: `METHOD:url`. */
  keyGenerator?: (req: Request) => string;
}

/**
 * Cria um middleware Express que cacheia respostas JSON. Adiciona o cabeçalho
 * `X-Cache: HIT|MISS` para facilitar a observabilidade.
 */
export function cacheMiddleware(options: CacheMiddlewareOptions) {
  const { cache } = options;
  const ttlSeconds = options.ttlSeconds;
  const methods = options.methods ?? ["GET"];
  const keyGenerator =
    options.keyGenerator ?? ((req: Request) => `${req.method}:${req.originalUrl}`);

  return function rustNodeCache(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    if (!methods.includes(req.method)) {
      next();
      return;
    }

    const key = keyGenerator(req);
    const cached = cache.get(key);
    if (cached !== null) {
      res.setHeader("X-Cache", "HIT");
      res.json(cached);
      return;
    }

    res.setHeader("X-Cache", "MISS");
    const originalJson = res.json.bind(res);
    res.json = (body: unknown): Response => {
      // Só guardamos respostas bem-sucedidas (2xx).
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(key, body, ttlSeconds ? { ttlSeconds } : undefined);
      }
      return originalJson(body);
    };

    next();
  };
}
