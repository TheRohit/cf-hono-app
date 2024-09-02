import { Hono } from "hono";
import type { KVNamespace } from "@cloudflare/workers-types";

type Bindings = {
  KV: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
  return c.text("Hello , the deploy works!");
});

app.put("/put/:key", async (c) => {
  const key = c.req.param("key");
  const body = await c.req.text();
  await c.env.KV.put(key, body);
  return c.text(`Put ${key} successfully!`);
});

app.get("/get/:key", async (c) => {
  const key = c.req.param("key");
  const value = await c.env.KV.get(key);
  if (value === null) {
    return c.text(`Key ${key} not found`, 404);
  }
  return c.text(value);
});

export default app;
