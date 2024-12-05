import type {
  Ai,
  KVNamespace,
  VectorizeIndex,
  Workflow,
} from "@cloudflare/workers-types";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { searchTranscriptions } from "./lib/search";
import { checkStatus, getTranscription, ytdlWorker } from "./lib/ytdl";
import { TranscriptionWorkflow } from "./workflows/transcription";

export interface Bindings {
  KV: KVNamespace;
  GROQ_API_KEY: string;
  TRANSCRIPTION_WORKFLOW: Workflow;
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
}

const app = new Hono<{ Bindings: Bindings }>();

app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", "summarisev2.rohitm.dev"],
    credentials: true,
  })
);

app.use("*", clerkMiddleware());

const authMiddleware = async (c: any, next: any) => {
  const auth = await getAuth(c);
  console.log(auth?.getToken());
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
};

app.use("/api/*", authMiddleware);

app.get("/", (c) => {
  return c.text("Hello , hehe");
});

app.post("/api/process-video/:id", async (c, env) => {
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

app.get("/api/status/:instanceId", async (c) => {
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

app.get("/api/transcription/:videoId", async (c) => {
  const videoId = c.req.param("videoId");
  if (!videoId) {
    return c.json({ error: "Missing video ID" }, 400);
  }
  const transcription = await getTranscription(videoId, c);
  return c.json(transcription);
});

app.get("/api/search", async (c) => {
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
