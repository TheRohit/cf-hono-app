import type { KVNamespace, R2Bucket } from "@cloudflare/workers-types";
import { Hono } from "hono";
import { download } from "./tasks/download";

export type Bindings = {
  KV: KVNamespace;
  R2: R2Bucket;
  PINECONE_API_KEY: string;
  COHERE_API_KEY: string;
  GROQ_API_KEY: string;
  DEEPGRAM_API_KEY: string;
  COOKIE: string;
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

app.get("/process-video/:id", async (c, env) => {
  try {
    const id = c.req.param("id");
    if (!id) {
      return c.json({ error: "Missing video ID" }, 400);
    }
    const result = await download(id, c);
    return c.json(result);
  } catch (error) {
    console.error("Error processing video:", error);
    return c.json(
      { error: "An error occurred while processing the video" },
      500
    );
  }
});

export default app;
