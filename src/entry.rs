//! A unidade de armazenamento do cache: `CacheEntry`.
//!
//! Cada chave aponta para uma `CacheEntry`. O valor é guardado já serializado
//! (`Vec<u8>` em JSON), o que desacopla o cache do formato dos dados e permite
//! trocar a estratégia de serialização no futuro (MessagePack, CBOR, Bincode)
//! sem mexer no resto do código.

use crate::ttl;

/// Uma entrada do cache.
///
/// Sobre *ownership* em Rust: a `CacheEntry` é **dona** dos seus bytes
/// (`Vec<u8>`). Quando a entrada é removida do `DashMap` (ou sobrescrita), o
/// Rust libera essa memória automaticamente — sem garbage collector e sem
/// `free()` manual. É o RAII garantindo que não há vazamento.
pub struct CacheEntry {
    /// Valor serializado em JSON.
    pub value: Vec<u8>,
    /// Instante de expiração em ms (Unix). `None` => nunca expira por tempo.
    pub expires_at: Option<u64>,
    /// Instante de criação em ms (Unix). Reservado para futuras políticas de
    /// evicção (LFU); ainda não é lido.
    #[allow(dead_code)]
    pub created_at: u64,
    /// Último acesso (criação ou `get` com hit) em ms (Unix). Base da evicção LRU:
    /// a entrada com o menor `last_accessed_at` é a candidata a sair quando o
    /// cache atinge `maxSize`.
    pub last_accessed_at: u64,
    /// Quantas vezes esta entrada específica foi lida com sucesso.
    pub hits: u64,
}

impl CacheEntry {
    /// Cria uma nova entrada já com o carimbo de criação preenchido.
    pub fn new(value: Vec<u8>, expires_at: Option<u64>, created_at: u64) -> Self {
        Self {
            value,
            expires_at,
            created_at,
            last_accessed_at: created_at,
            hits: 0,
        }
    }

    /// Atalho de conveniência: a entrada está expirada em relação a `now`?
    pub fn is_expired(&self, now: u64) -> bool {
        ttl::is_expired(self.expires_at, now)
    }
}
