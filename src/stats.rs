//! Contadores de estatísticas do cache.
//!
//! Por que `AtomicU64` em vez de `u64`?
//! O cache é acessado concorrentemente (o `DashMap` permite que várias threads
//! leiam/escrevam ao mesmo tempo). Se incrementássemos um `u64` comum a partir
//! de várias threads teríamos uma *data race* — comportamento indefinido. Os
//! atômicos permitem incrementos seguros **sem** um `Mutex`, usando instruções
//! de hardware. `Ordering::Relaxed` basta aqui: só queremos contadores corretos,
//! não estabelecer relações de "acontece-antes" com outras operações.

use std::sync::atomic::{AtomicU64, Ordering};

/// Conjunto de contadores acumulados desde a criação do cache.
#[derive(Default)]
pub struct CacheStats {
    /// Leituras que encontraram uma entrada válida.
    pub hits: AtomicU64,
    /// Leituras que não encontraram a chave (ou a encontraram expirada).
    pub misses: AtomicU64,
    /// Total de operações de escrita (`set`).
    pub sets: AtomicU64,
    /// Total de remoções explícitas bem-sucedidas (`delete`).
    pub deletes: AtomicU64,
    /// Total de entradas removidas por expiração (preguiçosa ou na varredura).
    pub expired: AtomicU64,
}

impl CacheStats {
    pub fn incr_hits(&self) {
        self.hits.fetch_add(1, Ordering::Relaxed);
    }

    pub fn incr_misses(&self) {
        self.misses.fetch_add(1, Ordering::Relaxed);
    }

    pub fn incr_sets(&self) {
        self.sets.fetch_add(1, Ordering::Relaxed);
    }

    pub fn incr_deletes(&self) {
        self.deletes.fetch_add(1, Ordering::Relaxed);
    }

    /// Soma `n` ao contador de expirados (a varredura remove em lote).
    pub fn add_expired(&self, n: u64) {
        self.expired.fetch_add(n, Ordering::Relaxed);
    }
}

/// Leitura imutável e consistente o suficiente dos contadores, mais o tamanho
/// atual. Devolvida ao JS pela API `stats()`.
pub struct StatsSnapshot {
    pub hits: u64,
    pub misses: u64,
    pub sets: u64,
    pub deletes: u64,
    pub expired: u64,
    pub size: u64,
}
