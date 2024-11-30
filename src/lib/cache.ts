import { Context } from "hono";
import { Bindings } from "..";

const KV_PREFIX = "transcription:";

export interface TranscriptionResult {
  videoInfo: {
    videoId: string;
    title: string;
    length: number;
    author: string;
    thumbnail: string;
    views: string;
    publishedAt: string;
  };
  transcription: string;
}

export const getCachedTranscription = async (
  videoId: string,
  c: Context<{ Bindings: Bindings }>
): Promise<TranscriptionResult | null> => {
  const cached = await c.env.KV.get(`${KV_PREFIX}${videoId}`, "json");
  return cached as TranscriptionResult | null;
};

export const cacheTranscription = async (
  videoId: string,
  result: TranscriptionResult,
  c: Context<{ Bindings: Bindings }>
) => {
  await c.env.KV.put(`${KV_PREFIX}${videoId}`, JSON.stringify(result), {
    expirationTtl: 60 * 60 * 24 * 30, // 30 days
  });
};
