import { Pinecone } from "@pinecone-database/pinecone";
import { Context } from "hono";
import { traceable } from "langsmith/traceable";
import {
  createPineconeIndex,
  updatePineconeWithTranscription,
} from "../utils/rag-util";
import { download } from "./download";
import { generateChapters } from "./generate-chapters";

import type { Bindings } from "../index";

const processVideo = traceable(
  async (c: Context<{ Bindings: Bindings }>, id: string) => {
    const client = new Pinecone({
      apiKey: c.env.PINECONE_API_KEY,
    });

    try {
      const cachedData = await c.env.KV.get(id);
      const parsed = JSON.parse(cachedData ?? "");

      if (parsed) {
        console.log("----- CACHED -----");
        const { transcription, videoInfo, output } = parsed;
        return {
          transcription,
          output,
          status: "complete",
          cached: true,
          videoInfo,
        };
      }

      // If not in cache, proceed with transcription
      const result = await download(id, c);
      const { transcription, videoInfo } = result;

      const output = await generateChapters(c, transcription ?? "");
      console.log("ADDED TO KV");
      await c.env.KV.put(
        id,
        JSON.stringify({ transcription, videoInfo, output })
      );

      await createPineconeIndex(client, "video-transcriptions", 1024);
      await updatePineconeWithTranscription(
        client,
        "video-transcriptions",
        transcription ?? "",
        id,
        c
      );

      return {
        transcription,
        output,
        status: "complete",
        cached: false,
        videoInfo,
      };
    } catch (error) {
      console.error("Error Processing Video", error);
      throw new Error("An error occurred during video processing");
    }
  },
  { name: "process-video" }
);

export default processVideo;
