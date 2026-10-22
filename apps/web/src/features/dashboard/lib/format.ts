/**
 * Format seconds as a clock value: `M:SS` under one hour (`113` → `1:53`),
 * `H:MM:SS` from one hour (`3725` → `1:02:05`). Negative input → `0:00`.
 */
export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

/** Legacy alias: the time bank always renders through the clock formatter. */
export function formatBank(seconds: number): string {
  return formatDuration(seconds);
}
