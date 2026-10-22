import type { LeaderboardRow } from "@mult/shared";

interface LeaderboardTableProps {
  rows: LeaderboardRow[];
}

/** 7-day leaderboard: earned time + accuracy per child. */
export function LeaderboardTable({ rows }: LeaderboardTableProps) {
  if (rows.length === 0) {
    return <p className="text-slate-500">No activity yet.</p>;
  }
  return (
    <table className="w-full text-left" data-testid="leaderboard">
      <thead>
        <tr className="border-b border-slate-200 text-sm text-slate-500">
          <th scope="col" className="py-2">
            Child
          </th>
          <th scope="col" className="py-2">
            Last 7 days
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.userId}
            className="border-b border-slate-100"
            data-testid={`row-${row.username}`}
          >
            <td className="py-2 font-semibold">{row.username}</td>
            <td className="py-2" data-testid={`score-${row.username}`}>
              +{row.timeEarnedSeconds}s ·{" "}
              {row.accuracy === null ? 0 : Math.round(row.accuracy * 100)}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
