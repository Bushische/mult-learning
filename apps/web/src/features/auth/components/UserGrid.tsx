import type { LoginGridUser } from "@mult/shared";

interface UserGridProps {
  users: LoginGridUser[];
  onSelect: (user: LoginGridUser) => void;
}

/** The tappable profile switcher — big touch targets (≥ 40 px). */
export function UserGrid({ users, onSelect }: UserGridProps) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3" data-testid="user-grid">
      {users.map((user) => (
        <li key={user.id}>
          <button
            type="button"
            data-testid="user-tile"
            onClick={() => onSelect(user)}
            className="min-h-[64px] w-full rounded-2xl bg-white px-4 py-6 text-xl font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-sky-300"
          >
            {user.username}
          </button>
        </li>
      ))}
    </ul>
  );
}
