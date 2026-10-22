/** Format seconds as `M:SS` (e.g. 45 → `0:45`, 2700 → `45:00`). */
export function formatBank(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}
