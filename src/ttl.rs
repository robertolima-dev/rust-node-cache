//! Utilitários de tempo / TTL (time-to-live).
//!
//! O cache guarda o instante de expiração de cada entrada em **milissegundos
//! desde a época Unix**. Centralizar o cálculo de tempo aqui mantém a lógica de
//! expiração consistente entre a leitura preguiçosa (em `get`) e a varredura
//! ativa (em `cleanup`).

use std::time::{SystemTime, UNIX_EPOCH};

/// Retorna o instante atual em milissegundos desde a época Unix.
///
/// Em caso de relógio anterior à época (praticamente impossível em produção),
/// devolvemos `0` em vez de entrar em pânico — robustez acima de precisão.
pub fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Decide se uma entrada está expirada dado o instante de expiração e o "agora".
///
/// `None` significa "sem TTL" (a entrada nunca expira por tempo). Comparamos com
/// `>=` para que um TTL de duração zero expire imediatamente.
pub fn is_expired(expires_at: Option<u64>, now: u64) -> bool {
    match expires_at {
        Some(expiry) => now >= expiry,
        None => false,
    }
}

/// Converte uma duração em segundos (vinda do JS) para o instante absoluto de
/// expiração em milissegundos, a partir de `now`.
pub fn expiry_from_seconds(now: u64, ttl_seconds: u32) -> u64 {
    now + (ttl_seconds as u64) * 1000
}
