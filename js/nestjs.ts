/**
 * Integração com NestJS: interceptor de cache de respostas.
 *
 * Uso:
 *   import { Cache } from "rust-node-cache";
 *   import { CacheInterceptor } from "rust-node-cache/nestjs";
 *
 *   const cache = new Cache();
 *   app.useGlobalInterceptors(new CacheInterceptor({ cache, ttlSeconds: 60 }));
 *
 * Usamos `import type` para `@nestjs/common`, ou seja, NÃO há import em runtime
 * do Nest aqui — o pacote não força o Nest como dependência. A única dependência
 * de runtime são os operadores `of`/`tap` do RxJS (presentes em qualquer app Nest).
 */

import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from "@nestjs/common";
import type { Observable } from "rxjs";
import { of, tap } from "rxjs";
import type { Cache } from "./index";

export interface CacheInterceptorOptions {
  /** Instância de cache a usar. */
  cache: Cache;
  /** TTL aplicado às respostas guardadas (em segundos). */
  ttlSeconds?: number;
  /** Métodos HTTP elegíveis para cache. Padrão: `["GET"]`. */
  methods?: string[];
  /** Gera a chave de cache a partir da requisição. Padrão: `METHOD:url`. */
  keyGenerator?: (req: { method: string; url: string }) => string;
}

/**
 * Interceptor NestJS que cacheia o valor retornado pelos handlers. Num HIT,
 * devolve o valor do cache sem executar o handler.
 */
export class CacheInterceptor implements NestInterceptor {
  private readonly cache: Cache;
  private readonly ttlSeconds?: number;
  private readonly methods: string[];
  private readonly keyGenerator: (req: {
    method: string;
    url: string;
  }) => string;

  constructor(options: CacheInterceptorOptions) {
    this.cache = options.cache;
    this.ttlSeconds = options.ttlSeconds;
    this.methods = options.methods ?? ["GET"];
    this.keyGenerator =
      options.keyGenerator ?? ((req) => `${req.method}:${req.url}`);
  }

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method: string;
      url: string;
    }>();

    if (!this.methods.includes(req.method)) {
      return next.handle();
    }

    const key = this.keyGenerator(req);
    const cached = this.cache.get(key);
    if (cached !== null) {
      return of(cached);
    }

    return next.handle().pipe(
      tap((body) => {
        if (body !== undefined && body !== null) {
          this.cache.set(
            key,
            body,
            this.ttlSeconds ? { ttlSeconds: this.ttlSeconds } : undefined,
          );
        }
      }),
    );
  }
}
