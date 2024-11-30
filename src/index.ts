import type {
  KVNamespace,
  R2Bucket,
  Workflow,
} from "@cloudflare/workers-types";
import { Hono } from "hono";
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
}

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

// Add status check endpoint
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

export default app;
export { TranscriptionWorkflow };
