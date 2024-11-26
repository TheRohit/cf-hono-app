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
    logDisplay: ["warning", "error"],
    clients: ["mweb", "web"],
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
    console.log("Processing video ID:", id);
    const info = await ytdl.getBasicInfo(id);
    console.log("Video info retrieved:", info.videoDetails.title);

    if (info.videoDetails.lengthSeconds > 7200) {
      throw new Error("Video is too long. Maximum duration is 2 hours.");
    }

    console.log("Starting video download...");
    const stream = await ytdl.download(id);
    console.log("Video download completed");

    // Convert stream to Blob
    const audioBlob = await new Response(stream).blob();
    console.log("Stream converted to blob, size:", audioBlob.size);

    // Create a File object from the Blob
    const audioFile = new File([audioBlob], `${id}.mp4`, {
      type: "audio/mp4",
    });

    console.log("Starting transcription...");
    // Get transcription from Groq
    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-large-v3-turbo",
      response_format: "verbose_json",
      prompt: "this is transcription of a youtube video",
    });
    console.log("Transcription completed");

    return {
      videoInfo: info,
      transcription: transcription,
    };
  } catch (error: unknown) {
    console.error("Error processing video:", error);
    throw error;
  }
};

export default ytdlWorker;
