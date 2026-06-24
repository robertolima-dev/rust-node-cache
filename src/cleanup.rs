//! Varredura ativa de entradas expiradas.
//!
//! O cache expira entradas de duas formas:
//! 1. **Preguiçosa** (lazy): em `get`/`exists`, se a entrada acessada já passou
//!    do prazo, ela é removida naquele momento.
//! 2. **Ativa** (esta varredura): percorre o mapa inteiro e remove tudo que está
//!    expirado de uma vez. Útil para liberar memória de chaves que nunca mais
//!    serão lidas. No roadmap (v0.2) isto vira uma thread periódica.
//!
//! Usamos `DashMap::retain`, que percorre os shards adquirindo o lock de cada um
//! por vez — não há um lock global, então outras threads continuam operando nos
//! demais shards durante a varredura.

use crate::entry::CacheEntry;
use crate::ttl;
use dashmap::DashMap;

/// Remove todas as entradas expiradas em relação a `now` e devolve quantas
/// foram removidas. A `closure` de `retain` é `FnMut`, então pode mutar o
/// contador `removed` a cada decisão.
pub fn sweep_expired(entries: &DashMap<String, CacheEntry>, now: u64) -> u64 {
    let mut removed = 0u64;
    entries.retain(|_key, entry| {
        let keep = !ttl::is_expired(entry.expires_at, now);
        if !keep {
            removed += 1;
        }
        keep
    });
    removed
}
