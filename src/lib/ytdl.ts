import { YtdlCore } from "@ybd-project/ytdl-core/serverless";
import { Groq } from "groq-sdk";
import { Context } from "hono";
import { Bindings } from "..";

export interface Env {
  GROQ_API_KEY: string;
}

interface VideoRequest {
  videoId: string;
}

export const ytdlWorker = async (
  id: string,
  c: Context<{ Bindings: Bindings }>
) => {
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

  const groq = new Groq({
    apiKey: c.env.GROQ_API_KEY,
  });

  if (!id) {
    throw new Error("No video ID provided");
  }

  try {
    const [info] = await Promise.all([ytdl.getBasicInfo(id)]);

    if (!info.videoDetails || !info.videoDetails.lengthSeconds) {
      throw new Error("Invalid video details");
    }

    if (info.videoDetails.lengthSeconds > 10800) {
      throw new Error("Video is too long. Maximum duration is 3 hours.");
    }

    console.log("Starting video download...");
    const stream = await ytdl.download(id);
    console.log("Video download completed");

    const audioBlob = await new Response(stream).blob();

    const audioFile = new File([audioBlob], `${id}.mp4`, {
      type: "audio/mp4",
    });

    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-large-v3-turbo",
      response_format: "verbose_json",
      prompt: "this is transcription of a youtube video",
    });
    console.log("Transcription completed");

    return {
      videoInfo: {
        title: info.videoDetails.title,
        length: info.videoDetails.lengthSeconds,
        author: info?.videoDetails?.author?.name,
      },
      transcription: transcription.text,
    };
  } catch (error: unknown) {
    console.error("Error:", error instanceof Error ? error.message : error);
    throw error;
  }
};

export default ytdlWorker;
