//! rust-node-cache
//!
//! Núcleo nativo (Rust) de um cache em memória ultrarrápido para Node.js.
//!
//! Como o Rust expõe uma **classe** para o Node:
//! O macro `#[napi]` (do crate `napi-derive`) gera, em tempo de compilação, a
//! "cola" N-API. Aplicado a uma `struct` + `impl`, ele cria uma classe
//! JavaScript de verdade: `new Cache()` no JS instancia a `struct` Rust, e cada
//! método `#[napi]` vira um método da instância. Nomes em `snake_case` viram
//! `camelCase` automaticamente (ex.: `cleanup_expired` -> `cleanupExpired`).
//!
//! Os tipos `i64`/`bool`/`String` viram `number`/`boolean`/`string` no JS. Para
//! valores arbitrários (objetos, arrays, etc.) usamos `serde_json::Value`, que o
//! napi converte de/para JavaScript graças à feature `serde-json`.

mod cache;
mod cleanup;
mod entry;
mod errors;
mod serializer;
mod stats;
mod ttl;

use cache::RustCache;
use napi_derive::napi;
use serde_json::Value;

/// Opções do construtor: `new Cache({ maxSize })`.
#[napi(object)]
pub struct CacheOptions {
    /// Limite opcional de chaves. Ao atingir, `set` de chave nova retorna `false`.
    pub max_size: Option<u32>,
}

/// Opções por escrita: `cache.set(key, value, { ttlSeconds })`.
#[napi(object)]
pub struct SetOptions {
    /// Tempo de vida em segundos. Ausente => a entrada não expira por tempo.
    pub ttl_seconds: Option<u32>,
}

/// Objeto devolvido por `cache.stats()`. Campos `i64` viram `number` no JS.
#[napi(object)]
pub struct CacheStatsObject {
    pub hits: i64,
    pub misses: i64,
    pub sets: i64,
    pub deletes: i64,
    pub expired: i64,
    pub size: i64,
}

/// Cache em memória exposto ao Node como a classe `Cache`.
///
/// Internamente delega tudo para o `RustCache` (que carrega o `DashMap` e os
/// contadores atômicos). Todos os métodos recebem `&self`: como o estado é
/// concorrente por dentro, várias chamadas podem rodar em paralelo.
#[napi]
pub struct Cache {
    inner: RustCache,
}

#[napi]
impl Cache {
    /// `new Cache()` ou `new Cache({ maxSize })`.
    #[napi(constructor)]
    pub fn new(options: Option<CacheOptions>) -> Self {
        let max_size = options.and_then(|o| o.max_size).map(|m| m as usize);
        Cache {
            inner: RustCache::new(max_size),
        }
    }

    /// Insere/atualiza uma chave. Retorna `true` em sucesso, `false` se o cache
    /// estiver cheio (`maxSize`) e a chave for nova.
    #[napi]
    pub fn set(
        &self,
        key: String,
        value: Value,
        options: Option<SetOptions>,
    ) -> napi::Result<bool> {
        let ttl_seconds = options.and_then(|o| o.ttl_seconds);
        Ok(self.inner.set(key, &value, ttl_seconds)?)
    }

    /// Lê uma chave. Retorna o valor ou `null` se ausente/expirada.
    #[napi]
    pub fn get(&self, key: String) -> napi::Result<Option<Value>> {
        Ok(self.inner.get(&key)?)
    }

    /// Remove uma chave. Retorna `true` se existia, `false` caso contrário.
    #[napi]
    pub fn delete(&self, key: String) -> bool {
        self.inner.delete(&key)
    }

    /// Indica se a chave existe e está válida (não expirada).
    #[napi]
    pub fn exists(&self, key: String) -> bool {
        self.inner.exists(&key)
    }

    /// Esvazia todas as entradas do cache.
    #[napi]
    pub fn clear(&self) {
        self.inner.clear();
    }

    /// Quantidade de chaves armazenadas no momento.
    #[napi]
    pub fn size(&self) -> i64 {
        self.inner.size() as i64
    }

    /// Varre e remove todas as entradas expiradas. Retorna quantas removeu.
    #[napi(js_name = "cleanupExpired")]
    pub fn cleanup_expired(&self) -> i64 {
        self.inner.cleanup_expired() as i64
    }

    /// Estatísticas acumuladas + tamanho atual.
    #[napi]
    pub fn stats(&self) -> CacheStatsObject {
        let s = self.inner.stats();
        CacheStatsObject {
            hits: s.hits as i64,
            misses: s.misses as i64,
            sets: s.sets as i64,
            deletes: s.deletes as i64,
            expired: s.expired as i64,
            size: s.size as i64,
        }
    }
}
