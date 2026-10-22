import { formatDuration } from "../../dashboard/lib/format";
import type { SessionSummary } from "../lib/session";

interface SessionSummaryCardProps {
  summary: SessionSummary;
  onPlayMore: () => void;
  onExit: () => void;
}

/** The end-of-session summary. */
export function SessionSummaryCard({ summary, onPlayMore, onExit }: SessionSummaryCardProps) {
  return (
    <section
      className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl bg-white p-6 shadow-sm"
      data-testid="summary"
    >
      <h2 className="text-2xl font-black">Well done!</h2>
      <p className="text-lg" data-testid="summary-tries">
        {summary.tries} questions · {summary.correct} correct
      </p>
      <p className="text-lg" data-testid="summary-accuracy">
        Accuracy: {summary.accuracyPercent}%
      </p>
      <p className="text-lg font-bold text-emerald-700" data-testid="summary-bank">
        +{formatDuration(summary.bankAdded)} earned
      </p>
      <div className="flex w-full flex-col gap-3">
        <button
          type="button"
          onClick={onPlayMore}
          className="min-h-[56px] rounded-2xl bg-sky-500 text-lg font-bold text-white"
        >
          Play more
        </button>
        <button
          type="button"
          onClick={onExit}
          className="min-h-[48px] rounded-2xl border border-slate-300 text-lg"
        >
          Back to dashboard
        </button>
      </div>
    </section>
  );
}
