//! O núcleo do cache: `RustCache`.
//!
//! Concorrência sem `Mutex` global:
//! O coração é um `DashMap<String, CacheEntry>`. O `DashMap` divide o mapa em
//! vários *shards*, cada um com seu próprio `RwLock`. Operações em chaves que
//! caem em shards diferentes acontecem **em paralelo de verdade**. Por isso
//! todos os métodos abaixo recebem `&self` (referência compartilhada) em vez de
//! `&mut self`: várias threads do Node podem chamar `get`/`set` ao mesmo tempo
//! sem um lock que serialize tudo.
//!
//! Cuidado com *deadlock*: dentro de um mesmo shard, segurar um guard de leitura
//! e tentar remover a mesma chave (que precisa do lock de escrita) trava. Por
//! isso, sempre soltamos (`drop`) o guard antes de chamar `remove`.

use crate::cleanup;
use crate::entry::CacheEntry;
use crate::errors::CacheError;
use crate::serializer;
use crate::stats::{CacheStats, StatsSnapshot};
use crate::ttl;
use dashmap::DashMap;
use serde_json::Value;

/// Cache em memória, thread-safe, com TTL opcional por entrada.
pub struct RustCache {
    /// Mapa concorrente chave -> entrada serializada.
    entries: DashMap<String, CacheEntry>,
    /// Contadores de hits/misses/sets/deletes/expired.
    stats: CacheStats,
    /// Limite opcional de número de chaves. Quando atingido, `set` de uma chave
    /// **nova** é rejeitado (retorna `false`). Políticas de evicção (LRU/LFU)
    /// estão no roadmap — por enquanto o limite é uma barreira simples.
    max_size: Option<usize>,
}

impl RustCache {
    /// Cria um cache vazio. `max_size = None` => sem limite de chaves.
    pub fn new(max_size: Option<usize>) -> Self {
        Self {
            entries: DashMap::new(),
            stats: CacheStats::default(),
            max_size,
        }
    }

    /// Insere ou sobrescreve uma chave. `ttl_seconds` define a expiração.
    ///
    /// Retorna `false` apenas quando há `max_size` definido, a chave é nova e o
    /// cache está cheio. Sobrescrever uma chave existente sempre é permitido.
    pub fn set(
        &self,
        key: String,
        value: &Value,
        ttl_seconds: Option<u32>,
    ) -> Result<bool, CacheError> {
        if let Some(max) = self.max_size {
            if self.entries.len() >= max && !self.entries.contains_key(&key) {
                return Ok(false);
            }
        }

        let bytes = serializer::serialize(value)?;
        let now = ttl::now_millis();
        let expires_at = ttl_seconds.map(|s| ttl::expiry_from_seconds(now, s));

        self.entries
            .insert(key, CacheEntry::new(bytes, expires_at, now));
        self.stats.incr_sets();
        Ok(true)
    }

    /// Lê uma chave. Aplica expiração preguiçosa: se a entrada está vencida, ela
    /// é removida e a leitura conta como *miss*.
    pub fn get(&self, key: &str) -> Result<Option<Value>, CacheError> {
        let now = ttl::now_millis();

        // `get_mut` segura o lock de escrita do shard durante este bloco. Se a
        // entrada for válida, incrementamos `hits` e retornamos já aqui (o guard
        // é solto no `return`). Se estiver expirada, apenas sinalizamos e
        // tratamos a remoção depois — fora do escopo do guard, evitando deadlock.
        let expired = if let Some(mut entry) = self.entries.get_mut(key) {
            if entry.is_expired(now) {
                true
            } else {
                entry.hits += 1;
                let value = serializer::deserialize(&entry.value)?;
                self.stats.incr_hits();
                return Ok(Some(value));
            }
        } else {
            self.stats.incr_misses();
            return Ok(None);
        };

        if expired {
            self.entries.remove(key);
            self.stats.add_expired(1);
            self.stats.incr_misses();
        }
        Ok(None)
    }

    /// Remove uma chave explicitamente. Retorna `true` se algo foi removido.
    pub fn delete(&self, key: &str) -> bool {
        if self.entries.remove(key).is_some() {
            self.stats.incr_deletes();
            true
        } else {
            false
        }
    }

    /// Verifica a existência de uma chave **válida**. Também aplica expiração
    /// preguiçosa: uma chave vencida é removida e considerada inexistente.
    pub fn exists(&self, key: &str) -> bool {
        let now = ttl::now_millis();

        // `get` segura o lock de LEITURA do shard. Precisamos soltá-lo (`drop`)
        // antes de `remove`, que exige o lock de ESCRITA do mesmo shard.
        let expired = if let Some(entry) = self.entries.get(key) {
            if entry.is_expired(now) {
                true
            } else {
                return true;
            }
        } else {
            return false;
        };

        if expired {
            self.entries.remove(key);
            self.stats.add_expired(1);
        }
        false
    }

    /// Esvazia o cache. Não mexe nos contadores acumulados (eles são históricos).
    pub fn clear(&self) {
        self.entries.clear();
    }

    /// Número de chaves atualmente armazenadas (pode incluir entradas expiradas
    /// que ainda não foram varridas nem acessadas).
    pub fn size(&self) -> usize {
        self.entries.len()
    }

    /// Varre e remove todas as entradas expiradas de uma vez. Retorna a
    /// quantidade removida.
    pub fn cleanup_expired(&self) -> u64 {
        let now = ttl::now_millis();
        let removed = cleanup::sweep_expired(&self.entries, now);
        self.stats.add_expired(removed);
        removed
    }

    /// Tira uma "foto" dos contadores + tamanho atual.
    pub fn stats(&self) -> StatsSnapshot {
        use std::sync::atomic::Ordering;
        StatsSnapshot {
            hits: self.stats.hits.load(Ordering::Relaxed),
            misses: self.stats.misses.load(Ordering::Relaxed),
            sets: self.stats.sets.load(Ordering::Relaxed),
            deletes: self.stats.deletes.load(Ordering::Relaxed),
            expired: self.stats.expired.load(Ordering::Relaxed),
            size: self.entries.len() as u64,
        }
    }
}
