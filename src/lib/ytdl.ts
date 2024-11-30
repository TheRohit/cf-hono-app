import { Context } from "hono";
import { Bindings } from "..";
import { Workflow } from "@cloudflare/workers-types";

import { TranscriptionResult } from "./cache";

export interface Env {
  GROQ_API_KEY: string;
  TRANSCRIPTION_WORKFLOW: Workflow;
}

const KV_PREFIX = "transcription:";

export const ytdlWorker = async (
  id: string,
  c: Context<{ Bindings: Bindings }>
) => {
  try {
    // Check if we already have the transcription in KV
    const cached = await c.env.KV.get(`${KV_PREFIX}${id}`, "json");
    if (cached) {
      console.log("Found cached transcription");
      return {
        ...cached,
        cached: true,
      };
    }

    // If not cached, start new workflow
    const instance = await c.env.TRANSCRIPTION_WORKFLOW.create({
      params: {
        videoId: id,
      },
    });

    return {
      instanceId: instance.id,
      status: await instance.status(),
      cached: false,
    };
  } catch (error: unknown) {
    console.error("Error:", error instanceof Error ? error.message : error);
    throw error;
  }
};

export const checkStatus = async (
  instanceId: string,
  c: Context<{ Bindings: Bindings }>
) => {
  const instance = await c.env.TRANSCRIPTION_WORKFLOW.get(instanceId);
  const status = await instance.status();

  if (status.status === "complete" && status.output) {
    const workflowOutput = status.output as {
      videoInfo: TranscriptionResult["videoInfo"];
      transcription: string;
    };

    const result: TranscriptionResult = {
      videoInfo: workflowOutput.videoInfo,
      transcription: workflowOutput.transcription,
    };

    await c.env.KV.put(
      `${KV_PREFIX}${result.videoInfo.videoId}`,
      JSON.stringify(result),
      {
        expirationTtl: 60 * 60 * 24 * 30, // Store for 30 days
      }
    );
  }

  return status;
};
