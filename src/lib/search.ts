import { Context } from "hono";
import { Bindings } from "..";

interface EmbeddingResponse {
  shape: number[];
  data: number[][];
}

function truncateMetadata(metadata: any): any {
  const maxBytes = 10000;
  let truncated = JSON.parse(JSON.stringify(metadata));
  const originalSize = JSON.stringify(truncated).length;

  if (originalSize > maxBytes) {
    console.warn(
      `Metadata size (${originalSize} bytes) exceeds limit. Truncating...`
    );
    // ... truncation logic ...
    console.warn(`Truncated to ${JSON.stringify(truncated).length} bytes`);
  }

  return truncated;
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
    topK: limit * 2,
    returnMetadata: true,
  });

  const videoMap = new Map();
  matches.matches.forEach((match) => {
    const videoId = match.metadata?.videoId as string;
    if (!videoMap.has(videoId) || match.score > videoMap.get(videoId).score) {
      videoMap.set(videoId, {
        score: match.score,
        videoId: match.metadata?.videoId as string,
        title: match.metadata?.title as string,
        author: match.metadata?.author as string,
        thumbnail: match.metadata?.thumbnail as string,
        transcription: match.metadata?.transcription as string,
      });
    }
  });

  return Array.from(videoMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
