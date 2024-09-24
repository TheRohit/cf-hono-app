import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { Context } from "hono";

import { z } from "zod";
import { Bindings } from "..";

const ChapterSchema = z.object({
  title: z.string(),
  timestamp: z.string(),
  summary: z.string(),
});

const ChaptersResponseSchema = z.object({
  chapters: z.array(ChapterSchema),
});

export type ChaptersResponse = z.infer<typeof ChaptersResponseSchema>;

export async function generateChapters(
  c: Context<{ Bindings: Bindings }>,
  input: string
): Promise<ChaptersResponse> {
  "use server";
  const groq = createOpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: c.env.GROQ_API_KEY,
  });

  const { object } = await generateObject({
    model: groq("llama-3.1-70b-versatile"),
    prompt: `You are an expert content analyzer. Your task is to create chapters and summaries for a YouTube video based on its transcription. Follow these guidelines:
1. Analyze the transcription and create chapters.
2. Each chapter should represent a distinct topic or section of the video.
3. Chapter titles should be concise (3-7 words) and descriptive.
4. Summaries should be upto 2-3 sentences long, capturing the main points of each chapter.
5. make sure you cover all the topics in the video.
Provide the output as a JSON array of chapter objects, each containing 'title', 'timestamp', and 'summary' fields. Here is the transcription:
${input}`,
    schema: ChaptersResponseSchema,
    temperature: 0.8,
  });

  return object;
}
