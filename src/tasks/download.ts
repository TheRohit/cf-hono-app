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

    console.log("Video info fetched successfully");

    console.log("Choosing format");
    const format = video.chooseFormat({
      type: "audio",
    });

    if (!format) {
      console.log("No suitable audio format found");
      return { error: "No suitable audio format found" };
    }

    console.log("Getting streaming data");
    const stream = await yt.download(id, {
      type: "audio",
    });

    let transcriptionResult: DeepgramResponse<SyncPrerecordedResponse>;
    try {
      transcriptionResult = await deepgram.listen.prerecorded.transcribeFile(
        stream as unknown as Buffer,
        {
          model: "nova-2",
          smart_format: true,
          mimetype: format.mime_type,
        }
      );
    } catch (deepgramError: unknown) {
      console.error("Deepgram API error:", deepgramError);
      return {
        error: `Deepgram API error: ${
          (deepgramError as Error).message || "Unknown error"
        }`,
      };
    }

    if (transcriptionResult.error) {
      console.error("Transcription error:", transcriptionResult.error);
      return { error: `Transcription error: ${transcriptionResult.error}` };
    }
    const subtitles = srt(transcriptionResult.result);
    const formattedSubtitles = formatSRT(subtitles);
    return {
      transcription: formattedSubtitles,
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
}
