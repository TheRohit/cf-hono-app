import {
  WorkflowEntrypoint,
  WorkflowStep,
  WorkflowEvent,
} from "cloudflare:workers";
import { YtdlCore } from "@ybd-project/ytdl-core/serverless";
import { Groq } from "groq-sdk";

type Env = {
  GROQ_API_KEY: string;
};

type Params = {
  videoId: string;
};

export class TranscriptionWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    try {
      // Step 1: Get video info
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
          title: info.videoDetails.title,
          length: info.videoDetails.lengthSeconds,
          author: info?.videoDetails?.author?.name,
        };
      });

      // Step 2: Download and transcribe
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
          // Download
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

          // Transcribe
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

      return {
        videoInfo,
        transcription,
      };
    } catch (error) {
      console.error("Workflow error:", error);
      throw error;
    }
  }
}
