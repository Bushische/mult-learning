import type { HeatmapCell } from "packages/shared";

interface HeatmapGridProps {
  cells: HeatmapCell[];
}

const COLOR_CLASS: Record<HeatmapCell["color"], string> = {
  none: "bg-slate-200",
  green: "bg-green-500",
  mixed: "bg-amber-500",
  red: "bg-red-500",
};

/**
 * The rolling 7-day heatmap — a pure display of what `GET /stats/heatmap`
 * returned (no math on the client).
 */
export function HeatmapGrid({ cells }: HeatmapGridProps) {
  const rowFactors = [...new Set(cells.map((cell) => cell.a))].sort((a, b) => a - b);
  const columnFactors = [...new Set(cells.map((cell) => cell.b))].sort((a, b) => a - b);

  if (cells.length === 0) {
    return <p className="text-slate-500">No games assigned yet.</p>;
  }

  return (
    <div className="overflow-x-auto" data-testid="heatmap">
      <table className="border-separate border-spacing-1">
        <thead>
          <tr>
            <th scope="col" className="p-1 text-xs text-slate-500">
              A \ B
            </th>
            {columnFactors.map((b) => (
              <th key={b} scope="col" className="p-1 text-xs font-semibold text-slate-600">
                {b}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowFactors.map((a) => (
            <tr key={a}>
              <th scope="row" className="p-1 text-xs font-semibold text-slate-600">
                {a}
              </th>
              {columnFactors.map((b) => {
                const cell = cells.find((entry) => entry.a === a && entry.b === b);
                if (!cell) {
                  return <td key={b} className="h-8 w-8" />;
                }
                const label =
                  cell.tries === 0
                    ? `${a} times ${b}: no tries`
                    : `${a} times ${b}: ${cell.tries} tries, ${Math.round(
                        (cell.accuracy ?? 0) * 100,
                      )}% correct`;
                return (
                  <td key={b} className="p-0">
                    <div
                      data-testid={`cell-${a}-${b}`}
                      data-color={cell.color}
                      title={label}
                      aria-label={label}
                      className={`h-8 w-8 rounded-md ${COLOR_CLASS[cell.color]}`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
