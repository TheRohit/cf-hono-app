import { Pinecone } from "@pinecone-database/pinecone";
import { traceable } from "langsmith/traceable";
import { download, VideoInfo } from "./download";
import { Context } from "hono";
import {
  createPineconeIndex,
  updatePineconeWithTranscription,
} from "../utils/rag-util";
import { generateChapters } from "./generate-chapters";
import { transcribe } from "./transcribe";

import type { Bindings } from "../index";

const processVideo = traceable(
  async (c: Context<{ Bindings: Bindings }>, id: string) => {
    const client = new Pinecone({
      apiKey: c.env.PINECONE_API_KEY,
    });

    try {
      // const cachedData = await c.env.KV.get<{
      //   transcription: string;
      //   videoInfo: VideoInfo;
      //   output: string;
      // }>(id);

      // if (cachedData) {
      //   console.log("----- CACHED -----");
      //   const { transcription, videoInfo, output } = cachedData;
      //   return {
      //     transcription,
      //     output,
      //     status: "complete",
      //     cached: true,
      //     videoInfo,
      //   };
      // }

      // If not in cache, proceed with transcription
      const result = await download(id, c);
      // const { transcription, videoInfo } = result;

      // const output = await generateChapters(c, transcription);

      // await c.env.KV.put(id, JSON.stringify({ transcription, output }));
      // await createPineconeIndex(client, "video-transcriptions", 1024);
      // await updatePineconeWithTranscription(
      //   client,
      //   "video-transcriptions",
      //   transcription,
      //   id,
      //   c
      // );

      // return {
      // transcription,
      // output,
      // status: "complete",
      // cached: false,
      // videoInfo,

      // };
      return result;
    } catch (error) {
      console.error("Error Processing Video", error);
      throw new Error("An error occurred during video processing");
    }
  },
  { name: "process-video" }
);

export default processVideo;
