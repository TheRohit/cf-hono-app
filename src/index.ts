import type {
  Ai,
  KVNamespace,
  R2Bucket,
  VectorizeIndex,
  Workflow,
} from "@cloudflare/workers-types";
import { Hono } from "hono";
import { searchTranscriptions } from "./lib/search";
import { checkStatus, ytdlWorker } from "./lib/ytdl";
import { TranscriptionWorkflow } from "./workflows/transcription";

export interface Bindings {
  KV: KVNamespace;
  R2: R2Bucket;
  PINECONE_API_KEY: string;
  COHERE_API_KEY: string;
  GROQ_API_KEY: string;
  DEEPGRAM_API_KEY: string;
  COOKIE: string;
  TRANSCRIPTION_WORKFLOW: Workflow;
  AI: Ai;
  VECTORIZE: VectorizeIndex;
}

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
  return c.text("Hello , hehe");
});

app.post("/process-video/:id", async (c, env) => {
  try {
    console.log("Processing video with id: ", c.req.param("id"));
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

app.get("/status/:instanceId", async (c) => {
  try {
    const instanceId = c.req.param("instanceId");
    if (!instanceId) {
      return c.json({ error: "Missing instance ID" }, 400);
    }
    const status = await checkStatus(instanceId, c);
    return c.json(status);
  } catch (error) {
    console.error("Error checking status:", error);
    return c.json(
      { error: "An error occurred while checking the workflow status" },
      500
    );
  }
});

app.get("/search", async (c) => {
  try {
    const query = c.req.query("q");
    if (!query) {
      return c.json({ error: "Missing search query" }, 400);
    }

    const results = await searchTranscriptions(query, c);
    return c.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return c.json(
      { error: "An error occurred while searching transcriptions" },
      500
    );
  }
});

export default app;
export { TranscriptionWorkflow };
