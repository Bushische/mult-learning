import type { AdminDailyRow } from "@mult/shared";
import { useState } from "react";
import { formatDuration } from "../../dashboard/lib/format";

interface StatsTabProps {
  rows: AdminDailyRow[];
}

/** Daily log per child + a user switcher. */
export function StatsTab({ rows }: StatsTabProps) {
  const [selected, setSelected] = useState<string>("all");

  const visible = selected === "all" ? rows : rows.filter((row) => row.userId === selected);

  return (
    <section className="flex flex-col gap-3" data-testid="stats-tab">
      <label className="flex flex-col text-sm">
        Child
        <select
          aria-label="Select child"
          className="min-h-[44px] rounded-xl border border-slate-300 px-3"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          <option value="all">All children</option>
          {rows.map((row) => (
            <option key={row.userId} value={row.userId}>
              {row.username}
            </option>
          ))}
        </select>
      </label>

      <table className="w-full text-left" data-testid="daily-log">
        <thead>
          <tr className="border-b border-slate-200 text-sm text-slate-500">
            <th scope="col" className="py-2">
              Child
            </th>
            <th scope="col" className="py-2">
              Tries
            </th>
            <th scope="col" className="py-2">
              Correct
            </th>
            <th scope="col" className="py-2">
              Earned
            </th>
            <th scope="col" className="py-2">
              Bank
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.userId} data-testid={`daily-row-${row.username}`}>
              <td className="py-2 font-semibold">{row.username}</td>
              <td className="py-2">{row.totalTries}</td>
              <td className="py-2">{row.correctTries}</td>
              <td className="py-2">+{formatDuration(row.timeEarnedSeconds)}</td>
              <td className="py-2">{formatDuration(row.timeBankSeconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
