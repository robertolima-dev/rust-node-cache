//! Estratégia de serialização.
//!
//! No MVP guardamos os valores como **JSON** dentro de um `Vec<u8>`. Por quê?
//! - É o denominador comum de qualquer valor que venha do JavaScript.
//! - Mantém o cache agnóstico ao formato: o `DashMap` só conhece bytes.
//! - Permite evoluir para formatos binários (MessagePack, CBOR, Bincode) no
//!   futuro trocando apenas este módulo, sem tocar na lógica do cache.
//!
//! O tipo de entrada/saída é `serde_json::Value`. Graças à feature `serde-json`
//! do napi, o próprio binding converte objetos/arrays/números JS de e para
//! `Value` automaticamente.

use crate::errors::CacheError;
use serde_json::Value;

/// Converte um valor JS (já como `Value`) em bytes JSON para armazenar.
pub fn serialize(value: &Value) -> Result<Vec<u8>, CacheError> {
    serde_json::to_vec(value).map_err(|e| CacheError::Serialize(e.to_string()))
}

/// Converte os bytes guardados de volta em um `Value` para devolver ao JS.
pub fn deserialize(bytes: &[u8]) -> Result<Value, CacheError> {
    serde_json::from_slice(bytes).map_err(|e| CacheError::Deserialize(e.to_string()))
}
