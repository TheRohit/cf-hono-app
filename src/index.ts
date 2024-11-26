import type { KVNamespace, R2Bucket } from "@cloudflare/workers-types";
import { Hono } from "hono";
import processVideo from "./tasks/process-video";
import { download } from "./tasks/download";
import ytdlWorker from "./lib/ytdl";

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
  return c.text("Hello , hehe");
});

app.get("/process-video/:id", async (c, env) => {
  try {
    console.log("----- PROCESSING VIDEO -----");
    const id = c.req.param("id");
    if (!id) {
      return c.json({ error: "Missing video ID" }, 400);
    }
    const result = await ytdlWorker(id, c);
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
