import { Context } from "hono";
import { Bindings } from "..";

interface EmbeddingResponse {
  shape: number[];
  data: number[][];
}

export async function searchTranscriptions(
  query: string,
  c: Context<{ Bindings: Bindings }>,
  limit: number = 5
) {
  const queryVector: EmbeddingResponse = await c.env.AI.run(
    "@cf/baai/bge-base-en-v1.5",
    {
      text: [query],
    }
  );

  const matches = await c.env.VECTORIZE.query(queryVector.data[0], {
    topK: limit,
    returnMetadata: true,
  });

  return matches.matches.map((match) => ({
    score: match.score,
    videoId: match.metadata?.videoId as string,
    title: match.metadata?.title as string,
    author: match.metadata?.author as string,
    thumbnail: match.metadata?.thumbnail as string,
    transcription: match.metadata?.transcription as string,
  }));
}
