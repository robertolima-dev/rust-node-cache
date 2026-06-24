// Exemplo Express — execute com: node examples/express-example.mjs
// Requer build local: npm run build
import express from "express";
import { Cache } from "rust-node-cache";
import { cacheMiddleware } from "rust-node-cache/express";

const cache = new Cache();
const app = express();

// Simula um banco de dados lento.
async function findUser(id) {
  await new Promise((r) => setTimeout(r, 100));
  return { id: Number(id), name: `User ${id}`, fetchedAt: Date.now() };
}

// Caching automático de respostas GET por 60s.
app.get(
  "/users/:id",
  cacheMiddleware({ cache, ttlSeconds: 60 }),
  async (req, res) => {
    const user = await findUser(req.params.id);
    res.json(user);
  },
);

// Uso manual do cache (padrão get/set explícito).
app.get("/manual/:id", async (req, res) => {
  const key = `user:${req.params.id}`;
  const cached = cache.get(key);
  if (cached) {
    return res.json({ source: "cache", ...cached });
  }
  const user = await findUser(req.params.id);
  cache.set(key, user, { ttlSeconds: 60 });
  res.json({ source: "db", ...user });
});

app.get("/stats", (_req, res) => {
  res.json(cache.stats());
});

app.listen(3000, () => {
  console.log("Express example on http://localhost:3000");
  console.log("Try: /users/1  /manual/1  /stats");
});
