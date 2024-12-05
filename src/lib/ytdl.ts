import { Workflow } from "@cloudflare/workers-types";
import { Context } from "hono";
import { Bindings } from "..";

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
    const cached = await c.env.KV.get(`${KV_PREFIX}${id}`, "json");
    if (cached) {
      return {
        cached: true,
        status: "complete",
      };
    }

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
    const { videoInfo, transcription } = status.output as {
      videoInfo: TranscriptionResult["videoInfo"];
      transcription: string;
    };

    const result: TranscriptionResult = {
      videoInfo,
      transcription,
    };

    return {
      status: status.status,
      error: status.error,
      output: result,
    };
  }

  return status;
};

export const getTranscription = async (
  videoId: string,
  c: Context<{ Bindings: Bindings }>
) => {
  const transcription = (await c.env.KV.get(
    `${KV_PREFIX}${videoId}`,
    "json"
  )) as TranscriptionResult | null;
  return {
    status: "complete",
    output: transcription,
  };
};
