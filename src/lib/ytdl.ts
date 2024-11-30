import { Context } from "hono";
import { Bindings } from "..";
import { Workflow } from "@cloudflare/workers-types";

export interface Env {
  GROQ_API_KEY: string;
  TRANSCRIPTION_WORKFLOW: Workflow;
}

export const ytdlWorker = async (
  id: string,
  c: Context<{ Bindings: Bindings }>
) => {
  try {
    // Create a new workflow instance
    const instance = await c.env.TRANSCRIPTION_WORKFLOW.create({
      params: {
        videoId: id,
      },
    });

    // Return the instance ID so the client can poll for status
    return {
      instanceId: instance.id,
      status: await instance.status(),
    };
  } catch (error: unknown) {
    console.error("Error:", error instanceof Error ? error.message : error);
    throw error;
  }
};

// Add a status check endpoint
export const checkStatus = async (
  instanceId: string,
  c: Context<{ Bindings: Bindings }>
) => {
  const instance = await c.env.TRANSCRIPTION_WORKFLOW.get(instanceId);
  return await instance.status();
};
