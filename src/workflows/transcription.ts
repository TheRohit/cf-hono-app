import { Ai, KVNamespace, Vectorize } from "@cloudflare/workers-types";
import { YtdlCore } from "@ybd-project/ytdl-core/serverless";
import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import { Groq } from "groq-sdk";
import { KV_PREFIX } from "../lib/cache";
import { splitTranscription, truncateMetadata } from "../lib/utils";

type Env = {
  GROQ_API_KEY: string;
  AI: Ai;
  VECTORIZE: Vectorize;
  KV: KVNamespace;
};

type Params = {
  videoId: string;
};

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

      await step.do("cache-transcription", async () => {
        await this.env.KV.put(
          `${KV_PREFIX}${event.payload.videoId}`,
          JSON.stringify({
            videoInfo,
            transcription,
          })
        );
      });

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
