import {
  WorkflowEntrypoint,
  WorkflowStep,
  WorkflowEvent,
} from "cloudflare:workers";
import { YtdlCore } from "@ybd-project/ytdl-core/serverless";
import { Groq } from "groq-sdk";
import { Ai, Vectorize } from "@cloudflare/workers-types";

type Env = {
  GROQ_API_KEY: string;
  AI: Ai;
  VECTORIZE: Vectorize;
};

type Params = {
  videoId: string;
};

function truncateMetadata(metadata: any): any {
  const maxBytes = 10000; // Setting slightly below 10240 for safety
  let truncated = JSON.parse(JSON.stringify(metadata));
  const originalSize = JSON.stringify(truncated).length;

  if (originalSize > maxBytes) {
    console.warn(
      `Metadata size (${originalSize} bytes) exceeds limit. Truncating...`
    );
    if (truncated.transcription) {
      while (JSON.stringify(truncated).length > maxBytes) {
        // Truncate the transcription by ~20% each time
        truncated.transcription = truncated.transcription.slice(
          0,
          Math.floor(truncated.transcription.length * 0.8)
        );
      }
    }
    console.warn(`Truncated to ${JSON.stringify(truncated).length} bytes`);
  }

  return truncated;
}

function splitTranscription(
  text: string,
  maxChunkSize: number = 512
): string[] {
  // Split into sentences (roughly)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if (
      (currentChunk + sentence).length > maxChunkSize &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += " " + sentence;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

export class TranscriptionWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    try {
      const videoInfo = await step.do("get-video-info", async () => {
        const ytdl = new YtdlCore({
          quality: "lowestaudio",
          filter: "audioonly",
          hl: "en",
          gl: "US",
          disableDefaultClients: true,
          disablePoTokenAutoGeneration: true,
          disableInitialSetup: true,
          parsesHLSFormat: false,
          noUpdate: true,
          logDisplay: ["error"],
          clients: ["mweb"],
          html5Player: {
            useRetrievedFunctionsFromGithub: true,
          },
        });

        const info = await ytdl.getBasicInfo(event.payload.videoId);

        if (!info.videoDetails || !info.videoDetails.lengthSeconds) {
          throw new Error("Invalid video details");
        }

        return {
          videoId: event.payload.videoId,
          title: info.videoDetails.title,
          length: info.videoDetails.lengthSeconds,
          author: info?.videoDetails?.author?.name ?? "",
          thumbnail: info?.videoDetails.thumbnails[0].url,
          views: info?.videoDetails.viewCount,
          publishedAt: info?.videoDetails.publishDate,
        };
      });

      const transcription = await step.do(
        "download-and-transcribe",
        {
          retries: {
            limit: 3,
            backoff: "exponential",
            delay: "5 seconds",
          },
          timeout: "15 minutes",
        },
        async () => {
          const ytdl = new YtdlCore({
            quality: "lowestaudio",
            filter: "audioonly",
            hl: "en",
            gl: "US",
            disableDefaultClients: true,
            disablePoTokenAutoGeneration: true,
            disableInitialSetup: true,
            parsesHLSFormat: false,
            noUpdate: true,
            logDisplay: ["error"],
            clients: ["mweb"],
            html5Player: {
              useRetrievedFunctionsFromGithub: true,
            },
          });

          const stream = await ytdl.download(event.payload.videoId);
          const response = new Response(stream);
          const arrayBuffer = await response.arrayBuffer();
          response.body?.cancel();

          const groq = new Groq({
            apiKey: this.env.GROQ_API_KEY,
          });

          const audioFile = new File(
            [arrayBuffer],
            `${event.payload.videoId}.mp4`,
            {
              type: "audio/mp4",
            }
          );

          const result = await groq.audio.transcriptions.create({
            file: audioFile,
            model: "whisper-large-v3-turbo",
            response_format: "verbose_json",
            prompt: "this is transcription of a youtube video",
          });

          return result.text;
        }
      );

      const embeddings = await step.do(
        "generate-embeddings",
        {
          retries: {
            limit: 2,
            backoff: "exponential",
            delay: "5 seconds",
          },
        },
        async () => {
          const chunks = splitTranscription(transcription);

          const modelResp = await this.env.AI.run("@cf/baai/bge-base-en-v1.5", {
            text: chunks,
          });

          const vectors = chunks.map((chunk, index) => ({
            id: `${event.payload.videoId}_${index}`,
            values: modelResp.data[index],
            metadata: truncateMetadata({
              videoId: videoInfo.videoId,
              title: videoInfo.title,
              author: videoInfo.author,
              thumbnail: videoInfo.thumbnail,
              transcription: chunk,
              chunkIndex: index,
              totalChunks: chunks.length,
            }),
          }));

          await this.env.VECTORIZE.upsert(vectors);

          return modelResp.data;
        }
      );

      return {
        videoInfo,
        transcription,
        embeddings,
      };
    } catch (error) {
      console.error("Workflow error:", error);
      throw error;
    }
  }
}
