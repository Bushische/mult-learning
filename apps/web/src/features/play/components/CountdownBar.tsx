interface CountdownBarProps {
  remaining: number;
  total: number;
}

/** The shrinking countdown bar (top HUD). */
export function CountdownBar({ remaining, total }: CountdownBarProps) {
  const share = total === 0 ? 0 : Math.max(0, Math.min(1, remaining / total));
  return (
    <div
      className="h-4 w-full overflow-hidden rounded-full bg-slate-200"
      data-testid="countdown"
      role="progressbar"
      tabIndex={-1}
      aria-valuenow={Math.round(share * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full ${share > 0.3 ? "bg-emerald-500" : "bg-red-500"}`}
        style={{ width: `${share * 100}%` }}
      />
    </div>
  );
}
