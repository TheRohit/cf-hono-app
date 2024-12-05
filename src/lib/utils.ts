export function truncateMetadata(metadata: any): any {
  const maxBytes = 10000; // Setting slightly below 10240 for safety
  let truncated = JSON.parse(JSON.stringify(metadata));
  const originalSize = JSON.stringify(truncated).length;

  if (originalSize > maxBytes) {
    console.warn(
      `Metadata size (${originalSize} bytes) exceeds limit. Truncating...`
    );
    if (truncated.transcription) {
      while (JSON.stringify(truncated).length > maxBytes) {
        // Truncate the transcription by ~20% each time
        truncated.transcription = truncated.transcription.slice(
          0,
          Math.floor(truncated.transcription.length * 0.8)
        );
      }
    }
    console.warn(`Truncated to ${JSON.stringify(truncated).length} bytes`);
  }

  return truncated;
}

export function splitTranscription(
  text: string,
  maxChunkSize: number = 512
): string[] {
  // Split into sentences (roughly)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if (
      (currentChunk + sentence).length > maxChunkSize &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += " " + sentence;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
