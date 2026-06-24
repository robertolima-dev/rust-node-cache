//! Erros do núcleo do cache.
//!
//! Usamos `thiserror` para descrever os erros de forma declarativa. A conversão
//! `From<CacheError> for napi::Error` permite usar o operador `?` nas funções
//! `#[napi]`: qualquer `CacheError` vira uma exceção JavaScript com mensagem
//! amigável quando propagada para o Node.

use thiserror::Error;

/// Erros que o cache pode produzir. No MVP eles vêm exclusivamente da camada de
/// serialização JSON (entrada/saída de valores).
#[derive(Error, Debug)]
pub enum CacheError {
    /// Falha ao serializar o valor recebido do JavaScript para bytes.
    #[error("failed to serialize value: {0}")]
    Serialize(String),

    /// Falha ao desserializar os bytes guardados de volta para um valor JS.
    #[error("failed to deserialize value: {0}")]
    Deserialize(String),
}

/// Ponte para o mundo N-API: transforma um erro do cache em uma exceção JS.
impl From<CacheError> for napi::Error {
    fn from(err: CacheError) -> Self {
        napi::Error::from_reason(err.to_string())
    }
}
