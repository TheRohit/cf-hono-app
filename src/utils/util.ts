export function formatSRT(srt: string): string {
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
  return `${hours?.padStart(2, "0")}:${minutes?.padStart(2, "0")}:${seconds?.padStart(2, "0")}`;
}
