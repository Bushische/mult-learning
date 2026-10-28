import { ALL_OPERATIONS, type HeatmapCell, OPERATION_SYMBOLS, type Operation } from "@mult/shared";

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
 * returned (no math on the client), one section per operation so mixed games
 * never blend `+` and `×` progress.
 */
export function HeatmapGrid({ cells }: HeatmapGridProps) {
  if (cells.length === 0) {
    return <p className="text-slate-500">No games assigned yet.</p>;
  }
  const present = new Set(cells.map((cell) => (cell.op ?? "mul") as Operation));
  const sections = ALL_OPERATIONS.filter((op) => present.has(op));

  return (
    <div className="flex flex-col gap-4" data-testid="heatmap">
      {sections.map((op) => (
        <HeatmapSection
          key={op}
          op={op}
          cells={cells.filter((cell) => (cell.op ?? "mul") === op)}
        />
      ))}
    </div>
  );
}

function HeatmapSection({ op, cells }: { op: Operation; cells: HeatmapCell[] }) {
  const rowFactors = [...new Set(cells.map((cell) => cell.a))].sort((a, b) => a - b);
  const columnFactors = [...new Set(cells.map((cell) => cell.b))].sort((a, b) => a - b);

  return (
    <section data-testid={`heatmap-section-${op}`}>
      <h3 className="mb-1 text-sm font-bold text-slate-600">
        <span aria-hidden="true">{OPERATION_SYMBOLS[op]}</span> ({op})
      </h3>
      <div className="overflow-x-auto">
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
                      ? `${a} ${OPERATION_SYMBOLS[op]} ${b}: no tries`
                      : `${a} ${OPERATION_SYMBOLS[op]} ${b}: ${cell.tries} tries, ${Math.round(
                          (cell.accuracy ?? 0) * 100,
                        )}% correct`;
                  return (
                    <td key={b} className="p-0">
                      <div
                        data-testid={`cell-${op}-${a}-${b}`}
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
    </section>
  );
}
