/* eslint-disable @typescript-eslint/no-empty-function */

import {
  createClient,
  DeepgramResponse,
  srt,
  SyncPrerecordedResponse,
} from "@deepgram/sdk";
import { Context } from "hono";
import type { Bindings } from "../index";
import { cloneInnertube } from "../utils/innertube";
import { formatSRT } from "../utils/util";

interface Thumbnail {
  url: string;
  width: number;
  height: number;
}

export interface VideoInfo {
  title?: string;
  description?: string;
  duration?: string;
  author?: string;
  viewCount?: string;
  thumbnails?: Thumbnail[];
}

export async function download(id: string, c: Context<{ Bindings: Bindings }>) {
  try {
    const deepgram = createClient(c.env.DEEPGRAM_API_KEY);
    console.log("Starting download for video ID:", id);

    const yt = await cloneInnertube(c);
    console.log("Innertube client created");

    console.log("Fetching video info");
    const video = await yt.getBasicInfo(id);

    const format = video.chooseFormat({
      type: "audio",
    });

    if (!format) {
      console.log("No suitable audio format found");
      return { error: "No suitable audio format found" };
    }

    const stream = await yt.getStreamingData(id, {
      type: "audio",
    });

    const url = stream?.url ?? "";

    try {
      const res = await deepgram.listen.prerecorded.transcribeUrl(
        { url: url },
        {
          use_enhanced: true,
          model: "nova-2",
          smart_format: true,
        }
      );

      return {
        transcription: res.result,
        videoInfo: {
          title: video?.basic_info?.title ?? "",
          description: video?.basic_info?.short_description ?? "",
          duration: video?.basic_info?.duration?.toString() ?? "",
          author: video?.basic_info?.author ?? "",
          viewCount: video?.basic_info?.view_count?.toString() ?? "",
          thumbnails:
            video?.basic_info?.thumbnail?.map((thumb) => ({
              url: thumb?.url,
              width: thumb?.width,
              height: thumb?.height,
            })) ?? [],
        },
      };
    } catch (error: unknown) {
      console.error("Error in download task:", error);

      return {
        error: `An error occurred during download: ${
          (error as Error).message || "Unknown error"
        }`,
      };
    }
  } catch (error: unknown) {
    console.error("Error in download task:", error);

    return {
      error: `An error occurred during download: ${
        (error as Error).message || "Unknown error"
      }`,
    };
  }
}
