import type { AdminUser, Game } from "packages/shared";
import { useState } from "react";
import { UserRow } from "./UserRow";

interface UsersTabProps {
  users: AdminUser[];
  games: Game[];
  onCreate: (payload: { username: string; pin: string; role: "admin" | "user" }) => void;
  onSave: (id: string, patch: { username?: string; pin?: string; role?: "admin" | "user" }) => void;
  onDelete: (id: string) => void;
  onAssign: (id: string, gameIds: string[]) => void;
  onReset: (id: string) => void;
}

/** User management: create, edit, assign games, delete, reset. */
export function UsersTab({
  users,
  games,
  onCreate,
  onSave,
  onDelete,
  onAssign,
  onReset,
}: UsersTabProps) {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");

  return (
    <section className="flex flex-col gap-4" data-testid="users-tab">
      <form
        className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          onCreate({ username, pin, role });
          setUsername("");
          setPin("");
        }}
      >
        <h2 className="text-lg font-bold">New user</h2>
        <input
          aria-label="New username"
          className="min-h-[44px] rounded-xl border border-slate-300 px-3"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <input
          aria-label="New PIN"
          className="min-h-[44px] rounded-xl border border-slate-300 px-3"
          value={pin}
          inputMode="numeric"
          maxLength={4}
          onChange={(event) => setPin(event.target.value)}
        />
        <select
          aria-label="New role"
          className="min-h-[44px] rounded-xl border border-slate-300 px-3"
          value={role}
          onChange={(event) => setRole(event.target.value === "admin" ? "admin" : "user")}
        >
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
        <button
          type="submit"
          className="min-h-[48px] rounded-xl bg-sky-500 px-4 text-lg font-bold text-white"
        >
          Create user
        </button>
      </form>

      <ul className="flex flex-col gap-3">
        {users.map((user) => (
          <UserRow
            key={user.id}
            user={user}
            games={games}
            onSave={onSave}
            onDelete={onDelete}
            onAssign={onAssign}
            onReset={onReset}
          />
        ))}
      </ul>
    </section>
  );
}
