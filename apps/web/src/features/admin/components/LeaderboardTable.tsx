import type { LeaderboardRow } from "@mult/shared";
import { Link } from "react-router-dom";
import { formatDuration } from "../../dashboard/lib/format";

interface LeaderboardTableProps {
  rows: LeaderboardRow[];
  /** Visible heading, e.g. "Today" or "Last 7 days". */
  title: string;
  /** Test id prefix: the table wrapper, rows and scores derive from it. */
  testId: string;
}

/** One leaderboard window: earned time (clock format) + accuracy per child. */
export function LeaderboardTable({ rows, title, testId }: LeaderboardTableProps) {
  if (rows.length === 0) {
    return (
      <div data-testid={testId}>
        <h3 className="mb-2 text-lg font-bold">{title}</h3>
        <p className="text-slate-500">No activity yet.</p>
      </div>
    );
  }
  return (
    <div data-testid={testId}>
      <h3 className="mb-2 text-lg font-bold">{title}</h3>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-slate-200 text-sm text-slate-500">
            <th scope="col" className="py-2">
              Child
            </th>
            <th scope="col" className="py-2">
              {title}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.userId}
              className="border-b border-slate-100"
              data-testid={`${testId}-row-${row.username}`}
            >
              <td className="py-2 font-semibold">
                <Link to={`/admin/users/${row.userId}/stats`} className="text-sky-700 underline">
                  {row.username}
                </Link>
              </td>
              <td className="py-2" data-testid={`${testId}-score-${row.username}`}>
                {formatDuration(row.timeEarnedSeconds)} ·{" "}
                {row.accuracy === null ? 0 : Math.round(row.accuracy * 100)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
