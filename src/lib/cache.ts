export const KV_PREFIX = "transcription:";

export interface TranscriptionResult {
  videoInfo: {
    videoId: string;
    title: string;
    length: number;
    author: string;
    thumbnail: string;
    views: string;
    publishedAt: string;
  };
  transcription: string;
}
