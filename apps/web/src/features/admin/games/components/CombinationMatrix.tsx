interface CombinationMatrixProps {
  rangeA: { min: number; max: number };
  rangeB: { min: number; max: number };
  selected: [number, number][];
  onChange: (next: [number, number][]) => void;
}

/** The visual A×B checkbox matrix — empty means "the whole range". */
export function CombinationMatrix({ rangeA, rangeB, selected, onChange }: CombinationMatrixProps) {
  const rows: number[] = [];
  for (let a = rangeA.min; a <= rangeA.max; a += 1) rows.push(a);
  const columns: number[] = [];
  for (let b = rangeB.min; b <= rangeB.max; b += 1) columns.push(b);

  const isSelected = (a: number, b: number) =>
    selected.some((entry) => entry[0] === a && entry[1] === b);

  const toggle = (a: number, b: number) => {
    if (isSelected(a, b)) {
      onChange(selected.filter((entry) => !(entry[0] === a && entry[1] === b)));
      return;
    }
    onChange([...selected, [a, b]]);
  };

  return (
    <div className="flex flex-col gap-2" data-testid="combination-matrix">
      <p className="text-sm text-slate-600">
        {selected.length === 0
          ? "No combination pinned — the whole range is used."
          : `${selected.length} combination(s) pinned.`}
      </p>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-1">
          <thead>
            <tr>
              <th scope="col" className="text-xs text-slate-500">
                A \ B
              </th>
              {columns.map((b) => (
                <th key={b} scope="col" className="text-xs text-slate-600">
                  {b}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a}>
                <th scope="row" className="text-xs text-slate-600">
                  {a}
                </th>
                {columns.map((b) => (
                  <td key={b}>
                    <input
                      type="checkbox"
                      aria-label={`${a}x${b}`}
                      checked={isSelected(a, b)}
                      onChange={() => toggle(a, b)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
