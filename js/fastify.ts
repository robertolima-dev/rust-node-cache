/**
 * Integração com Fastify: cache de respostas JSON via plugin.
 *
 * Uso:
 *   import { Cache } from "rust-node-cache";
 *   import { cachePlugin } from "rust-node-cache/fastify";
 *
 *   const cache = new Cache();
 *   fastify.register(cachePlugin, { cache, ttlSeconds: 60 });
 *
 * Fluxo: o hook `onRequest` checa o cache e, num HIT, responde imediatamente
 * (curto-circuito). Num MISS, o hook `onSend` guarda o payload serializado.
 */

import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import type { Cache } from "./index";

export interface CachePluginOptions {
  /** Instância de cache a usar. */
  cache: Cache;
  /** TTL aplicado às respostas guardadas (em segundos). */
  ttlSeconds?: number;
  /** Métodos HTTP elegíveis para cache. Padrão: `["GET"]`. */
  methods?: string[];
  /** Gera a chave de cache a partir da requisição. Padrão: `METHOD:url`. */
  keyGenerator?: (req: FastifyRequest) => string;
}

// Guardamos a chave calculada na própria request entre os hooks.
const CACHE_KEY = Symbol("rustNodeCacheKey");

/**
 * Plugin Fastify que cacheia respostas JSON. Use com `fastify.register`.
 */
export async function cachePlugin(
  fastify: FastifyInstance,
  options: CachePluginOptions,
): Promise<void> {
  const { cache } = options;
  const ttlSeconds = options.ttlSeconds;
  const methods = options.methods ?? ["GET"];
  const keyGenerator =
    options.keyGenerator ?? ((req: FastifyRequest) => `${req.method}:${req.url}`);

  fastify.addHook(
    "onRequest",
    (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
      if (!methods.includes(request.method)) {
        done();
        return;
      }

      const key = keyGenerator(request);
      const cached = cache.get(key);
      if (cached !== null) {
        reply.header("X-Cache", "HIT");
        reply.send(cached);
        return; // não chama done(): a resposta já foi enviada.
      }

      reply.header("X-Cache", "MISS");
      (request as unknown as Record<symbol, string>)[CACHE_KEY] = key;
      done();
    },
  );

  fastify.addHook(
    "onSend",
    (
      request: FastifyRequest,
      reply: FastifyReply,
      payload: unknown,
      done: (err: Error | null, value?: unknown) => void,
    ) => {
      const key = (request as unknown as Record<symbol, string | undefined>)[
        CACHE_KEY
      ];
      if (
        key &&
        typeof payload === "string" &&
        reply.statusCode >= 200 &&
        reply.statusCode < 300
      ) {
        try {
          cache.set(
            key,
            JSON.parse(payload),
            ttlSeconds ? { ttlSeconds } : undefined,
          );
        } catch {
          // payload não-JSON: simplesmente não cacheia.
        }
      }
      done(null, payload);
    },
  );
}
