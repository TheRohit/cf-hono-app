import { createClient, srt } from "@deepgram/sdk";
import fs from "fs";
import { Context } from "hono";
import { Bindings } from "..";

export async function transcribe(
  c: Context<{ Bindings: Bindings }>,
  audioPath: string
) {
  const deepgram = createClient(c.env.DEEPGRAM_API_KEY);
  try {
    const fileData = fs.readFileSync(audioPath);
    const blob = new Blob([fileData], { type: "audio/webm" });
    if (!(blob instanceof Blob)) throw new Error("No audio detected");

    console.log("----- Transcribing audio -----");
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      fileData,
      {
        model: "nova-2",
        smart_format: true,
      }
    );
    if (error) console.error(error);

    fs.unlinkSync(audioPath);

    const subtitles = srt(result);
    const formattedSubtitles = formatSRT(subtitles);
    console.log("----- Subtitles generated -----");
    return formattedSubtitles;
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw new Error("Error transcribing audio. Please try again later.");
  }
}

function formatSRT(srt: string): string {
  const lines = srt.split("\n");
  let formatted = "";
  let currentTime = "";
  let isSubtitleText = false;

  for (const line of lines) {
    if (line.includes("-->")) {
      currentTime = formatTime(line?.split(" --> ")[0] ?? "");
      isSubtitleText = true;
    } else if (line.trim() !== "" && isSubtitleText) {
      formatted += `${currentTime} ${line}\n`;
      isSubtitleText = false;
    }
  }

  return formatted.trim();
}

function formatTime(time: string): string {
  const [hours, minutes, seconds] = time.split(/[:,.]/);
  return `${hours?.padStart(2, "0")}:${minutes?.padStart(
    2,
    "0"
  )}:${seconds?.padStart(2, "0")}`;
}
