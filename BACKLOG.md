# Project: rust-node-cache

## Goal

Build a production-ready Node.js in-memory cache powered by Rust.

Package name:

```txt
rust-node-cache
```

Technology stack:

* Rust
* napi-rs
* TypeScript
* Node.js
* GitHub Actions
* npm

The implementation must follow exactly the same architecture, build process, npm publishing workflow, CI/CD structure and project conventions used in:

```txt
/Users/robertolima/Documents/projects/rust/study/rust_node_monitor
```

Use rust-node-monitor as the reference project for:

* folder structure
* package.json organization
* Cargo.toml organization
* napi-rs configuration
* GitHub Actions
* multi-platform builds
* release workflow
* npm publishing
* TypeScript definitions
* README style

---

# Product Vision

Provide an ultra-fast local in-memory cache for Node.js applications.

Target frameworks:

* Express
* Fastify
* NestJS
* Hono
* Next.js
* plain Node.js

Tagline:

```txt
Ultra-fast in-memory cache powered by Rust.
```

---

# MVP Features

## Cache Class

```ts
import { Cache } from "rust-node-cache";

const cache = new Cache();
```

---

## set()

```ts
cache.set("user:1", {
  id: 1,
  name: "Roberto",
});
```

Returns:

```ts
true
```

---

## get()

```ts
const user = cache.get("user:1");
```

Returns:

```ts
{
  id: 1,
  name: "Roberto"
}
```

or

```ts
null
```

---

## delete()

```ts
cache.delete("user:1");
```

Returns:

```ts
true
```

or

```ts
false
```

---

## exists()

```ts
cache.exists("user:1");
```

Returns:

```ts
true
```

or

```ts
false
```

---

## clear()

```ts
cache.clear();
```

---

## size()

```ts
cache.size();
```

Returns:

```ts
42
```

---

# TTL Support

Set with expiration:

```ts
cache.set(
  "session:123",
  session,
  {
    ttlSeconds: 60
  }
);
```

After expiration:

```ts
cache.get("session:123");
```

Returns:

```ts
null
```

---

# Stats

```ts
cache.stats();
```

Returns:

```ts
{
  hits: 1500,
  misses: 200,
  sets: 800,
  deletes: 20,
  expired: 15,
  size: 780
}
```

---

# API

## Constructor

```ts
const cache = new Cache();
```

Future:

```ts
const cache = new Cache({
  maxSize: 100000,
  cleanupIntervalSeconds: 60,
});
```

---

# Rust Architecture

Folder structure:

```txt
rust-node-cache/
├── Cargo.toml
├── package.json
├── README.md
├── LICENSE
├── src/
│   ├── lib.rs
│   ├── cache.rs
│   ├── entry.rs
│   ├── ttl.rs
│   ├── stats.rs
│   ├── serializer.rs
│   ├── cleanup.rs
│   └── errors.rs
├── js/
│   ├── index.ts
│   ├── express.ts
│   ├── fastify.ts
│   └── nestjs.ts
├── test/
│   ├── cache.test.ts
│   ├── ttl.test.ts
│   ├── stats.test.ts
│   └── concurrency.test.ts
├── npm/
├── examples/
└── .github/
```

---

# Internal Rust Structures

Cache Entry:

```rust
pub struct CacheEntry {
    pub value: Vec<u8>,
    pub expires_at: Option<u64>,
    pub created_at: u64,
    pub hits: u64,
}
```

Cache:

```rust
pub struct RustCache {
    entries: DashMap<String, CacheEntry>,
}
```

Stats:

```rust
pub struct CacheStats {
    hits: AtomicU64,
    misses: AtomicU64,
    sets: AtomicU64,
    deletes: AtomicU64,
    expired: AtomicU64,
}
```

---

# Rust Dependencies

```toml
napi
napi-derive
dashmap
serde
serde_json
thiserror
```

---

# Serialization Strategy

MVP:

Use JSON serialization.

Store internally:

```txt
Vec<u8>
```

Future:

```txt
MessagePack
CBOR
Bincode
```

---

# Testing Requirements

Create tests for:

1. set/get
2. missing key
3. exists
4. delete
5. clear
6. size
7. overwrite existing key
8. ttl expiration
9. stats hits
10. stats misses
11. cleanup expired
12. concurrency
13. large object storage

Use:

```txt
vitest
```

---

# Express Helper

Example:

```ts
import { Cache } from "rust-node-cache";

const cache = new Cache();

app.get("/users/:id", async (req, res) => {
  const key = `user:${req.params.id}`;

  const cached = cache.get(key);

  if (cached) {
    return res.json(cached);
  }

  const user = await database.findUser();

  cache.set(key, user, {
    ttlSeconds: 60,
  });

  return res.json(user);
});
```

---

# Future Decorator API

```ts
@Cacheable({
  ttlSeconds: 60,
})
async function getUser(id: number) {}
```

---

# CI/CD

Must follow exactly the same workflow used in rust-node-monitor.

Include:

## Pull Requests

* cargo fmt
* cargo clippy
* cargo test
* npm test

## Main Branch

Build:

```txt
Linux x64
Linux ARM64
macOS Intel
macOS ARM64
Windows x64
```

Generate binaries through napi-rs.

---

# npm Publishing

Follow rust-node-monitor strategy exactly.

Generated packages:

```txt
linux-x64
linux-arm64
darwin-x64
darwin-arm64
win32-x64-msvc
```

---

# README.md (FULLY IN ENGLISH)

Create a production-grade README.

Sections:

# rust-node-cache

Short description.

---

## Features

* Rust-powered
* Thread-safe
* TTL support
* Fast reads
* Fast writes
* TypeScript support
* Framework agnostic

---

## Installation

```bash
npm install rust-node-cache
```

---

## Quick Start

Full example.

---

## Basic Usage

set()

get()

delete()

exists()

clear()

size()

---

## TTL

Full examples.

---

## Statistics

Full examples.

---

## Performance

Explain:

```txt
Rust Core
DashMap
Lock-free reads
Low allocation
Fast TTL checks
```

---

## Architecture

Explain:

```txt
Node.js
 ↓
napi-rs
 ↓
Rust Cache Engine
 ↓
DashMap
```

---

## API Reference

Document every public method.

---

## Express Example

Full example.

---

## Fastify Example

Full example.

---

## NestJS Example

Full example.

---

## Benchmarks

Create benchmark section.

Initial benchmark placeholder:

```txt
Coming soon.
```

---

## Limitations

* Local process only
* Not distributed
* Data lost on restart
* Multiple workers have separate caches

---

## Roadmap

### v0.1

Basic Cache

### v0.2

TTL Cleanup Thread

### v0.3

LRU Cache

### v0.4

LFU Cache

### v0.5

Redis Synchronization

### v0.6

Prometheus Metrics

### v0.7

ImmutableLog Integration

---

## Development

```bash
npm install
npm run build
npm test
```

---

## Publishing

```bash
npm version patch
git push --tags
```

---

## License

MIT

---

# Future ImmutableLog Integration

Future support:

```ts
cache.onEvicted((event) => {
  immutablelog.send(event);
});
```

Events:

```json
{
  "event_type": "cache_evicted",
  "key": "user:123",
  "reason": "expired"
}
```

---

# Development Rules

Act as a senior Rust + Node.js engineer.

Always:

* follow rust-node-monitor conventions
* create tests before moving forward
* explain Rust ownership
* explain DashMap
* explain napi-rs
* explain serialization choices
* explain concurrency
* keep API simple
* keep README production quality

Start with:

**Step 1**

Analyze rust-node-monitor and replicate the same project foundation before implementing cache logic.
