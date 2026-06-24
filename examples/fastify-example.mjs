// Exemplo Fastify — execute com: node examples/fastify-example.mjs
// Requer build local: npm run build
import Fastify from "fastify";
import { Cache } from "rust-node-cache";
import { cachePlugin } from "rust-node-cache/fastify";

const cache = new Cache();
const fastify = Fastify();

async function findUser(id) {
  await new Promise((r) => setTimeout(r, 100));
  return { id: Number(id), name: `User ${id}`, fetchedAt: Date.now() };
}

// Registra o plugin de cache: respostas GET ficam em cache por 60s.
fastify.register(cachePlugin, { cache, ttlSeconds: 60 });

fastify.get("/users/:id", async (req) => findUser(req.params.id));

fastify.get("/stats", async () => cache.stats());

fastify.listen({ port: 3001 }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Fastify example on ${address}`);
  console.log("Try: /users/1  /stats");
});
