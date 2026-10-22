import { computeRewardSeconds } from "@mult/shared";
import { formatDuration } from "../../dashboard/lib/format";

interface CountdownBarProps {
  remaining: number;
  total: number;
  baseTimeReward: number;
  questionSeconds: number;
}

/**
 * The shrinking countdown bar (top HUD) with the decaying earning on top:
 * `min +0:00` on the left, `max +<base>` on the right and the current earning
 * riding the bar from right (start) to left (timeout).
 */
export function CountdownBar({
  remaining,
  total,
  baseTimeReward,
  questionSeconds,
}: CountdownBarProps) {
  const share = total === 0 ? 0 : Math.max(0, Math.min(1, remaining / total));
  const elapsed = Math.max(0, total - remaining);
  const max = computeRewardSeconds({ baseTimeReward, questionSeconds, elapsedMs: 0 });
  const current = computeRewardSeconds({ baseTimeReward, questionSeconds, elapsedMs: elapsed });
  const position = max === 0 ? 0 : Math.max(0, Math.min(1, current / max));

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-semibold">
        <span className="text-slate-500" data-testid="earning-min">
          min +{formatDuration(0)}
        </span>
        <span className="text-emerald-700" data-testid="earning-max">
          max +{formatDuration(max)}
        </span>
      </div>
      <div
        className="relative h-4 w-full overflow-hidden rounded-full bg-slate-200"
        data-testid="countdown"
        role="progressbar"
        tabIndex={-1}
        aria-valuenow={Math.round(share * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Reward: current +${formatDuration(current)}, max +${formatDuration(
          max,
        )}, min +${formatDuration(0)}`}
      >
        <div
          className={`h-full ${share > 0.3 ? "bg-emerald-500" : "bg-red-500"}`}
          style={{ width: `${share * 100}%` }}
          data-testid="countdown-fill"
        />
        <span
          data-testid="earning-current"
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-1 text-[10px] font-bold text-slate-700 shadow"
          style={{ left: `${position * 100}%` }}
        >
          +{formatDuration(current)}
        </span>
      </div>
    </div>
  );
}
