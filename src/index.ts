import { Hono } from "hono";
import type { KVNamespace } from "@cloudflare/workers-types";

type Bindings = {
  KV: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
  return c.text("Hello , the deploy works!");
});

app.put("/add/:key", async (c) => {
  const key = c.req.param("key");
  const body = await c.req.text();
  await c.env.KV.put(key, body);
  return c.text(`Put ${key} successfully!`);
});

export default app;
