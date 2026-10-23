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

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Format a `YYYY-MM-DD` date as `DD.MMM` (`2026-10-22` → `22.Oct`). */
export function formatDayLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return date;
  }
  return `${day}.${SHORT_MONTHS[month - 1] as string}`;
}
