# rust-node-cache

**Ultra-fast in-memory cache powered by Rust.**

`rust-node-cache` is a high-performance in-memory cache for Node.js applications
with a core written in Rust. It is built on top of a concurrent, lock-sharded
hash map ([DashMap](https://docs.rs/dashmap)), giving you fast reads, fast
writes, and thread-safe access with very low overhead.

It ships as a prebuilt native addon (via [napi-rs](https://napi.rs/)), so there
is **no compiler required at install time** on supported platforms.

[![CI](https://github.com/robertolima-dev/rust-node-cache/actions/workflows/CI.yml/badge.svg)](https://github.com/robertolima-dev/rust-node-cache/actions/workflows/CI.yml)
[![npm](https://img.shields.io/npm/v/rust-node-cache.svg)](https://www.npmjs.com/package/rust-node-cache)
![node](https://img.shields.io/badge/node-%3E%3D18-43853d)
![license](https://img.shields.io/badge/license-MIT-blue)

🌐 **Website:** [rust-node-cache.vercel.app](https://rust-node-cache.vercel.app/)

---

## Features

- 🦀 **Rust-powered** core for predictable, low-overhead performance
- 🔒 **Thread-safe** via `DashMap` (lock-sharded concurrent map)
- ⏱️ **TTL support** per entry (lazy expiration + active cleanup)
- 🧹 **Background expiration** — optional sweeper thread (`cleanupIntervalSeconds`)
- 🧠 **LRU eviction** — bound the cache by `maxSize` with `evictionPolicy: "lru"`
- ⚡ **Fast reads** and **fast writes**
- 📊 Built-in **statistics** (hits, misses, sets, deletes, expired, evicted, size)
- 🧩 **TypeScript** support with generics out of the box
- 🌐 **Framework agnostic** — works with Express, Fastify, NestJS, Hono,
  Next.js, or plain Node.js

---

## Installation

```bash
npm install rust-node-cache
```

Works with both **ESM** and **CommonJS**, and requires **Node.js 18+**.

---

## Quick Start

```ts
import { Cache } from "rust-node-cache";

const cache = new Cache();

cache.set("user:1", { id: 1, name: "Roberto" });

const user = cache.get<{ id: number; name: string }>("user:1");
console.log(user); // { id: 1, name: "Roberto" }
```

```js
// CommonJS
const { Cache } = require("rust-node-cache");

const cache = new Cache();
cache.set("greeting", "hello");
console.log(cache.get("greeting")); // "hello"
```

---

## Basic Usage

### `set(key, value, options?)`

Stores (or overwrites) a value. Returns `true` on success, or `false` when a
`maxSize` limit is set, the cache is full, and the key is new.

```ts
cache.set("user:1", { id: 1, name: "Roberto" });
cache.set("session:123", session, { ttlSeconds: 60 });
```

### `get(key)`

Returns the stored value, or `null` if the key is missing or expired.

```ts
const user = cache.get<User>("user:1"); // User | null
```

### `delete(key)`

Removes a key. Returns `true` if it existed, `false` otherwise.

```ts
cache.delete("user:1"); // true
```

### `exists(key)`

Returns `true` if the key exists and is still valid (not expired).

```ts
cache.exists("user:1"); // boolean
```

### `clear()`

Removes every entry from the cache.

```ts
cache.clear();
```

### `size()`

Returns the number of keys currently stored.

```ts
cache.size(); // 42
```

---

## TTL

Set an entry with an expiration in seconds:

```ts
cache.set("session:123", session, { ttlSeconds: 60 });
```

After the TTL elapses, reads return `null`:

```ts
cache.get("session:123"); // null (once expired)
```

Expiration is **lazy** by default: an expired entry is evicted the moment it is
accessed. To proactively reclaim memory from keys that are never read again, run
an active sweep:

```ts
const removed = cache.cleanupExpired(); // number of entries removed
```

Or let the cache sweep for you in the background — set `cleanupIntervalSeconds`
and a thread reclaims expired entries on its own (no manual `cleanupExpired()`):

```ts
const cache = new Cache({ cleanupIntervalSeconds: 30 });
```

The thread is tied to the cache's lifetime: it stops automatically when the cache
is garbage-collected.

---

## Eviction (maxSize)

Cap the number of keys with `maxSize`. When the cache is full and a **new** key
is written, `evictionPolicy` decides what happens:

```ts
// Default: reject the write (set returns false), keep existing entries.
const a = new Cache({ maxSize: 1000 }); // evictionPolicy: "reject"

// LRU: evict the least-recently-used entry to make room, then insert.
const b = new Cache({ maxSize: 1000, evictionPolicy: "lru" });
b.evictionPolicy; // "lru"
```

LRU recency is tracked per entry (updated on every `get` hit) and the evicted
count is surfaced in `stats().evicted`. Overwriting an existing key never evicts.

---

## Statistics

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
  evicted: 40,
  size: 780
}
```

Counters are cumulative for the lifetime of the cache instance. `clear()` empties
the storage but does **not** reset the historical counters.

---

## Performance

The cache core is implemented entirely in Rust and tuned for throughput:

- **Rust core** — no GC pauses on the cache itself; deterministic memory handling
  via RAII (entries are freed the instant they leave the map).
- **DashMap** — the map is split into multiple internal shards, each guarded by
  its own lock, so operations on different keys proceed in parallel.
- **Lock-free reads** for statistics — counters use atomic integers
  (`AtomicU64`) and are incremented with relaxed atomics, avoiding a global lock.
- **Low allocation** — values are stored as a single contiguous `Vec<u8>`; there
  is no per-field boxing.
- **Fast TTL checks** — expiration is a single integer comparison against a
  cached millisecond timestamp.

---

## Architecture

```txt
Node.js
 ↓
napi-rs   (the Rust ⇆ V8 bridge: #[napi] generates the glue code)
 ↓
Rust Cache Engine   (set / get / ttl / stats / cleanup)
 ↓
DashMap   (concurrent, lock-sharded HashMap<String, CacheEntry>)
```

Values cross the boundary as `serde_json::Value` and are serialized to JSON
bytes (`Vec<u8>`) inside the engine. This keeps the storage layer agnostic to the
shape of your data and leaves room to adopt binary formats (MessagePack, CBOR,
Bincode) later without touching the cache logic.

---

## API Reference

| Method                         | Returns        | Description                                                       |
| ------------------------------ | -------------- | ----------------------------------------------------------------- |
| `new Cache(options?)`          | `Cache`        | Create a cache (`maxSize`, `evictionPolicy`, `cleanupIntervalSeconds`). |
| `set(key, value, options?)`    | `boolean`      | Store/overwrite a value. `options.ttlSeconds` sets expiration.    |
| `evictionPolicy` (getter)      | `string`       | The active policy: `"reject"` or `"lru"`.                         |
| `get<T>(key)`                  | `T \| null`    | Read a value (lazy-expires stale entries).                        |
| `delete(key)`                  | `boolean`      | Remove a key. `true` if it existed.                               |
| `exists(key)`                  | `boolean`      | Whether the key exists and is valid.                              |
| `clear()`                      | `void`         | Remove all entries.                                               |
| `size()`                       | `number`       | Number of keys currently stored.                                  |
| `cleanupExpired()`             | `number`       | Sweep expired entries; returns how many were removed.             |
| `stats()`                      | `CacheStats`   | Cumulative counters + current size.                               |

### Types

```ts
interface CacheOptions {
  maxSize?: number;
  evictionPolicy?: "reject" | "lru"; // default "reject"
  cleanupIntervalSeconds?: number; // enables the background sweeper
}

interface SetOptions {
  ttlSeconds?: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  expired: number;
  evicted: number;
  size: number;
}
```

---

## Express Example

```ts
import express from "express";
import { Cache } from "rust-node-cache";
import { cacheMiddleware } from "rust-node-cache/express";

const cache = new Cache();
const app = express();

// Automatic response caching (adds an `X-Cache: HIT|MISS` header).
app.get("/users/:id", cacheMiddleware({ cache, ttlSeconds: 60 }), async (req, res) => {
  const user = await database.findUser(req.params.id);
  res.json(user);
});

// Or use the cache manually.
app.get("/manual/:id", async (req, res) => {
  const key = `user:${req.params.id}`;
  const cached = cache.get(key);
  if (cached) return res.json(cached);

  const user = await database.findUser(req.params.id);
  cache.set(key, user, { ttlSeconds: 60 });
  res.json(user);
});
```

---

## Fastify Example

```ts
import Fastify from "fastify";
import { Cache } from "rust-node-cache";
import { cachePlugin } from "rust-node-cache/fastify";

const cache = new Cache();
const fastify = Fastify();

fastify.register(cachePlugin, { cache, ttlSeconds: 60 });

fastify.get("/users/:id", async (req) => {
  return database.findUser(req.params.id);
});
```

---

## NestJS Example

```ts
import { Cache } from "rust-node-cache";
import { CacheInterceptor } from "rust-node-cache/nestjs";

const cache = new Cache();

// Apply globally...
app.useGlobalInterceptors(new CacheInterceptor({ cache, ttlSeconds: 60 }));

// ...or per controller/route with @UseInterceptors(new CacheInterceptor({ cache })).
```

---

## Benchmarks

Coming soon.

---

## Limitations

- Local process only
- Not distributed
- Data is lost on restart
- Multiple workers (cluster / PM2) have separate, independent caches

---

## Roadmap

| Version | Feature                  | Status |
| ------- | ------------------------ | ------ |
| v0.1    | Basic cache              | ✅     |
| v0.2    | TTL cleanup thread + LRU eviction | ✅ |
| v0.3    | LFU cache                | 🔜     |
| v0.4    | Redis synchronization    | 🔜     |
| v0.5    | Prometheus metrics       | 🔜     |
| v0.6    | ImmutableLog integration | 🔜     |

### Future: ImmutableLog Integration

```ts
cache.onEvicted((event) => {
  immutablelog.send(event);
});
```

```json
{
  "event_type": "cache_evicted",
  "key": "user:123",
  "reason": "expired"
}
```

### Future: Decorator API

```ts
@Cacheable({ ttlSeconds: 60 })
async function getUser(id: number) {}
```

---

## Development

```bash
npm install
npm run build   # builds the native addon + the TypeScript layer
npm test
```

The build runs in two stages:

- `npm run build:native` — compiles the Rust crate and emits the platform addon
  plus `binding.js` / `binding.d.ts` (the native loader and its types).
- `npm run build:js` — bundles the TypeScript layer in `js/` into `dist/` (CJS +
  ESM + type declarations) with [tsup](https://tsup.egoist.dev/).

---

## Publishing

```bash
npm version patch
git push --tags
```

Pushing a `vX.Y.Z` tag triggers CI to build every platform binary, bundle them
into a single self-contained package, and publish it to npm.

---

## License

MIT © [Roberto Lima](https://github.com/robertolima-dev)
